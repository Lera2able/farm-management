import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  ensureBootstrapUser,
  getAdminClient,
  groupForId,
  handleOptions,
  hashPassword,
  hashToken,
  json,
  logAudit,
  randomToken,
  readJson,
  requireSession,
  sendResendEmail,
} from "../_shared/helpers.ts";

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readJson(req) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const supabase = getAdminClient();

    if (!action) return json(400, { ok: false, error: "Missing action" });
    const normalizeSpecies = (raw: unknown) => {
      const s = String(raw ?? "").trim().toLowerCase();
      if (s === "goat" || s === "goats" || s === "dipodi") return "goat";
      if (s === "sheep" || s === "dinku") return "sheep";
      return "";
    };
    const speciesLabel = (species: string) => (species === "goat" ? "Goat" : "Sheep");

    if (action === "login") {
      await ensureBootstrapUser(supabase);
      const password = String(body.password ?? "");
      if (!password) return json(400, { ok: false, error: "Missing password" });
      const passwordHash = await hashPassword(password);
      const { data: users, error } = await supabase
        .from("farm_owner_users")
        .select("name,role,password_hash,is_active")
        .eq("is_active", true);
      if (error) throw error;
      const match = (users ?? []).find((u) => u.password_hash === passwordHash);
      if (!match) return json(200, { ok: false, error: "Wrong password" });

      const token = randomToken();
      const tokenHash = await hashToken(token);
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await supabase.from("farm_owner_sessions").insert({
        token_hash: tokenHash,
        user_name: match.name,
        role: match.role,
        expires_at: expiresAt,
      });
      if (sessionError) throw sessionError;
      return json(200, { ok: true, token, name: match.name, role: match.role, expires_at: expiresAt });
    }

    if (action === "logAudit") {
      await logAudit(supabase, {
        action: String(body.type ?? "event"),
        livestock_id: body.livestockId ? String(body.livestockId) : null,
        detail: body.detail ? String(body.detail) : null,
        actor: body.actor ? String(body.actor) : null,
        source: body.source ? String(body.source) : null,
      });
      return json(200, { ok: true });
    }

    if (action === "saveAttendance") {
      const date = String(body.date ?? "");
      const presentIds = Array.isArray(body.presentIds) ? body.presentIds.map((x) => String(x)) : [];
      const absentIds = Array.isArray(body.absentIds) ? body.absentIds.map((x) => String(x)) : [];
      const by = String(body.by ?? "Modisa");
      if (!date) return json(400, { ok: false, error: "Missing date" });

      const { data: existing, error: existingError } = await supabase
        .from("farm_attendance")
        .select("date,present_livestock")
        .eq("date", date)
        .maybeSingle();
      if (existingError) throw existingError;

      const merged = new Set<string>((existing?.present_livestock ?? []).map((x: string) => String(x)));
      presentIds.forEach((id) => merged.add(String(id)));
      absentIds.forEach((id) => merged.delete(String(id)));
      const finalIds = [...merged].sort();

      const { count: totalActive, error: countError } = await supabase
        .from("farm_livestock")
        .select("id", { count: "exact", head: true })
        .eq("is_inactive", false);
      if (countError) throw countError;

      const { error: upsertError } = await supabase.from("farm_attendance").upsert({
        date,
        shepherd_name: by,
        recorded_at: new Date().toISOString(),
        present_livestock: finalIds,
        present_count: finalIds.length,
        total_active: totalActive ?? null,
      }, { onConflict: "date" });
      if (upsertError) throw upsertError;

      return json(200, {
        ok: true,
        row: {
          date,
          present_ids: finalIds,
          updated_by: by,
          updated_at: new Date().toISOString(),
        },
      });
    }

    if (action === "getAttendance") {
      let query = supabase
        .from("farm_attendance")
        .select("date,present_livestock,shepherd_name,recorded_at")
        .order("date", { ascending: false });
      if (body.date) query = query.eq("date", String(body.date));
      const { data, error } = await query;
      if (error) throw error;
      return json(200, {
        ok: true,
        rows: (data ?? []).map((r) => ({
          date: r.date,
          present_ids: Array.isArray(r.present_livestock) ? r.present_livestock : [],
          updated_by: r.shepherd_name,
          updated_at: r.recorded_at,
        })),
      });
    }

    if (action === "setHealth") {
      const livestockId = String(body.livestockId ?? "");
      const sick = !!body.sick;
      const dead = !!body.dead;
      const by = String(body.by ?? "Modisa");
      if (!livestockId) return json(400, { ok: false, error: "Missing livestockId" });

      if (!sick && !dead) {
        const { error } = await supabase.from("farm_health").delete().eq("livestock_id", livestockId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("farm_health").upsert({
          livestock_id: livestockId,
          sick,
          dead,
          updated_by: by,
          updated_at: new Date().toISOString(),
        }, { onConflict: "livestock_id" });
        if (error) throw error;
      }

      return json(200, { ok: true });
    }

    if (action === "getHealth") {
      const { data, error } = await supabase
        .from("farm_health")
        .select("livestock_id,sick,dead,updated_by,updated_at")
        .order("livestock_id", { ascending: true });
      if (error) throw error;
      return json(200, { ok: true, rows: data ?? [] });
    }

    if (action === "getSmallStockRegistry") {
      const species = normalizeSpecies(body.species);
      let query = supabase
        .from("farm_smallstock_registry")
        .select("tag_id,species,is_active,sex,note,updated_by,updated_at,source")
        .eq("is_active", true)
        .order("tag_id", { ascending: true });
      if (species) query = query.eq("species", species);
      const { data, error } = await query;
      if (error) throw error;
      return json(200, {
        ok: true,
        rows: (data ?? []).map((r) => ({
          id: r.tag_id,
          species: r.species,
          is_active: !!r.is_active,
          sex: r.sex,
          note: r.note,
          updated_by: r.updated_by,
          updated_at: r.updated_at,
          source: r.source,
        })),
      });
    }

    if (action === "getSmallStockAttendance") {
      const species = normalizeSpecies(body.species);
      if (!species) return json(400, { ok: false, error: "Missing species" });
      let query = supabase
        .from("farm_smallstock_attendance")
        .select("species,attendance_date,present_tags,updated_by,recorded_at,comment")
        .eq("species", species)
        .order("attendance_date", { ascending: false });
      if (body.date) query = query.eq("attendance_date", String(body.date));
      const { data, error } = await query;
      if (error) throw error;
      return json(200, {
        ok: true,
        rows: (data ?? []).map((r) => ({
          species: r.species,
          date: r.attendance_date,
          present_ids: Array.isArray(r.present_tags) ? r.present_tags : [],
          updated_by: r.updated_by,
          updated_at: r.recorded_at,
          comment: r.comment,
        })),
      });
    }

    if (action === "saveSmallStockAttendance") {
      const species = normalizeSpecies(body.species);
      const date = String(body.date ?? "");
      const by = String(body.by ?? "Modisa");
      const comment = String(body.comment ?? "").trim();
      const presentIds = Array.isArray(body.presentIds)
        ? [...new Set(body.presentIds.map((x) => String(x).trim()).filter(Boolean))].sort()
        : [];
      if (!species) return json(400, { ok: false, error: "Missing species" });
      if (!date) return json(400, { ok: false, error: "Missing date" });

      const { count: totalActive, error: countError } = await supabase
        .from("farm_smallstock_registry")
        .select("tag_id", { count: "exact", head: true })
        .eq("species", species)
        .eq("is_active", true);
      if (countError) throw countError;

      const { error: upsertError } = await supabase.from("farm_smallstock_attendance").upsert({
        species,
        attendance_date: date,
        present_tags: presentIds,
        present_count: presentIds.length,
        total_active: totalActive ?? null,
        updated_by: by,
        recorded_at: new Date().toISOString(),
        comment: comment || null,
        source: "app",
      }, { onConflict: "species,attendance_date" });
      if (upsertError) throw upsertError;

      await logAudit(supabase, {
        action: "smallstock_attendance_saved",
        actor: by,
        source: species,
        detail: `${species}:${date}:${presentIds.length}`,
      });

      const label = speciesLabel(species);
      const text = [
        `Khumotaka ${label.toLowerCase()} attendance summary`,
        `Species: ${label}`,
        `Date: ${date}`,
        `Updated by: ${by}`,
        `Present: ${presentIds.length}`,
        ...(totalActive != null ? [`Total active: ${String(totalActive)}`] : []),
        ...(comment ? [`Comment: ${comment}`] : []),
      ].join("\n");
      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h2 style="margin-bottom:8px">Khumotaka ${label} attendance summary</h2>
          <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
            <tr><td><b>Species</b></td><td>${label}</td></tr>
            <tr><td><b>Date</b></td><td>${date}</td></tr>
            <tr><td><b>Updated by</b></td><td>${by}</td></tr>
            <tr><td><b>Present</b></td><td>${presentIds.length}</td></tr>
            ${totalActive != null ? `<tr><td><b>Total active</b></td><td>${String(totalActive)}</td></tr>` : ""}
            ${comment ? `<tr><td><b>Comment</b></td><td>${comment}</td></tr>` : ""}
          </table>
        </div>
      `;
      const mailResult = await sendResendEmail({
        subject: `Khumotaka ${label} attendance: ${date}`,
        text,
        html,
      });
      if (!mailResult.ok) {
        console.error("[farm-admin] small stock attendance email not sent", species, date, mailResult.reason);
      }

      return json(200, {
        ok: true,
        row: {
          species,
          date,
          present_ids: presentIds,
          updated_by: by,
          updated_at: new Date().toISOString(),
          comment,
        },
      });
    }

    const auth = await requireSession(
      supabase,
      body,
      action === "createUser" || action === "deleteUser" || action === "listUsers" ? "supersuper" : "super",
    );
    if (!auth.ok) return auth.response;
    const actor = auth.session.name;

    if (action === "listUsers") {
      const { data, error } = await supabase
        .from("farm_owner_users")
        .select("name,role,is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return json(200, { ok: true, users: data ?? [] });
    }

    if (action === "createUser") {
      const name = String(body.name ?? "").trim();
      const password = String(body.password ?? "");
      const role = String(body.role ?? "super") === "supersuper" ? "supersuper" : "super";
      if (!name || !password) return json(400, { ok: false, error: "Name and password needed" });
      const passwordHash = await hashPassword(password);

      const { data: dupPassword, error: dupError } = await supabase
        .from("farm_owner_users")
        .select("name")
        .eq("password_hash", passwordHash);
      if (dupError) throw dupError;
      if ((dupPassword ?? []).length) return json(400, { ok: false, error: "Choose a different password" });

      const { error } = await supabase.from("farm_owner_users").insert({
        name,
        role,
        password_hash: passwordHash,
        is_active: true,
      });
      if (error) throw error;
      await logAudit(supabase, { action: "user_created", actor, detail: `${name} (${role})`, source: "owner" });
      return json(200, { ok: true });
    }

    if (action === "deleteUser") {
      const name = String(body.name ?? "").trim();
      if (!name) return json(400, { ok: false, error: "Missing user name" });
      if (name === actor) return json(400, { ok: false, error: "You cannot delete yourself" });
      const { error } = await supabase
        .from("farm_owner_users")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("name", name);
      if (error) throw error;
      await supabase.from("farm_owner_sessions").update({ is_revoked: true }).eq("user_name", name);
      await logAudit(supabase, { action: "user_deleted", actor, detail: name, source: "owner" });
      return json(200, { ok: true });
    }

    if (action === "updateLineage") {
      const id = String(body.id ?? "").trim();
      if (!id) return json(400, { ok: false, error: "Missing animal id" });
      const patch: Record<string, unknown> = {
        mother_id: body.motherId ? String(body.motherId) : null,
        father_id: body.fatherId ? String(body.fatherId) : null,
        sex: body.sex ? String(body.sex) : null,
        date_of_birth: body.dateOfBirth ? String(body.dateOfBirth) : null,
        updated_by: actor,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("farm_livestock").update(patch).eq("id", id);
      if (error) throw error;
      if (body.comment) {
        await supabase.from("farm_comments").insert({
          livestock_id: id,
          comment: String(body.comment),
          author: actor,
        });
      }
      await logAudit(supabase, { action: "lineage_updated", livestock_id: id, actor, source: "owner" });
      return json(200, { ok: true });
    }

    if (action === "registerCalf") {
      const id = String(body.id ?? "").trim();
      if (!id) return json(400, { ok: false, error: "Missing tag number" });
      const { data: existing, error: existingError } = await supabase
        .from("farm_livestock")
        .select("id,group_name")
        .eq("id", id)
        .maybeSingle();
      if (existingError) throw existingError;
      const groupName = body.group ? String(body.group) : groupForId(id);
      const { error } = await supabase.from("farm_livestock").upsert({
        id,
        group_name: groupName,
        is_inactive: false,
        status: "active",
        mother_id: body.motherId ? String(body.motherId) : null,
        father_id: body.fatherId ? String(body.fatherId) : null,
        sex: body.sex ? String(body.sex) : null,
        date_of_birth: body.dateOfBirth ? String(body.dateOfBirth) : null,
        updated_by: actor,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw error;
      if (body.comment) {
        await supabase.from("farm_comments").insert({
          livestock_id: id,
          comment: String(body.comment),
          author: actor,
        });
      }
      const actionName = groupName === "calves" ? "calf_added" : "registry_added";
      await logAudit(supabase, { action: actionName, livestock_id: id, actor, source: "owner" });
      if (!existing) {
        const typeLabel = groupName === "calves" ? "Calf" : "Cow";
        const noteParts = [
          `${typeLabel} tag: ${id}`,
          `Added by: ${actor}`,
          `Source: owner panel`,
        ];
        if (body.motherId) noteParts.push(`Mother: ${String(body.motherId)}`);
        if (body.fatherId) noteParts.push(`Father: ${String(body.fatherId)}`);
        if (body.sex) noteParts.push(`Sex: ${String(body.sex)}`);
        if (body.dateOfBirth) noteParts.push(`Date of birth: ${String(body.dateOfBirth)}`);
        if (body.comment) noteParts.push(`Comment: ${String(body.comment)}`);
        const text = [
          "Khumotaka new registry entry",
          ...noteParts,
        ].join("\n");
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
            <h2 style="margin-bottom:8px">Khumotaka new registry entry</h2>
            <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
              <tr><td><b>Type</b></td><td>${typeLabel}</td></tr>
              <tr><td><b>Tag</b></td><td>${id}</td></tr>
              <tr><td><b>Added by</b></td><td>${actor}</td></tr>
              <tr><td><b>Source</b></td><td>Owner panel</td></tr>
              ${body.motherId ? `<tr><td><b>Mother</b></td><td>${String(body.motherId)}</td></tr>` : ""}
              ${body.fatherId ? `<tr><td><b>Father</b></td><td>${String(body.fatherId)}</td></tr>` : ""}
              ${body.sex ? `<tr><td><b>Sex</b></td><td>${String(body.sex)}</td></tr>` : ""}
              ${body.dateOfBirth ? `<tr><td><b>Date of birth</b></td><td>${String(body.dateOfBirth)}</td></tr>` : ""}
              ${body.comment ? `<tr><td><b>Comment</b></td><td>${String(body.comment)}</td></tr>` : ""}
            </table>
          </div>
        `;
        const mailResult = await sendResendEmail({
          subject: `Khumotaka new entry: ${id}`,
          text,
          html,
        });
        if (!mailResult.ok) {
          console.error("[farm-admin] new entry email not sent", id, mailResult.reason);
        }
      }
      return json(200, { ok: true, id });
    }

    if (action === "editAnimal") {
      const id = String(body.id ?? "").trim();
      const newId = String(body.newId ?? id).trim();
      if (!id || !newId) return json(400, { ok: false, error: "Missing animal id" });
      if (newId !== id) {
        const { data: existing, error: existingError } = await supabase
          .from("farm_livestock")
          .select("id")
          .eq("id", newId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) return json(400, { ok: false, error: "Number already exists" });
      }

      const { data: current, error: currentError } = await supabase
        .from("farm_livestock")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json(404, { ok: false, error: "Animal not found" });

      if (newId !== id) {
        const { error: insertError } = await supabase.from("farm_livestock").insert({
          ...current,
          id: newId,
          group_name: groupForId(newId),
          name: body.name ? String(body.name) : null,
          date_of_birth: body.dateOfBirth ? String(body.dateOfBirth) : null,
          updated_by: actor,
          updated_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;

        await supabase.from("farm_comments").update({ livestock_id: newId }).eq("livestock_id", id);
        await supabase.from("farm_health").update({ livestock_id: newId }).eq("livestock_id", id);
        await supabase.from("farm_audit").update({ livestock_id: newId }).eq("livestock_id", id);
        await supabase.from("farm_livestock").update({ mother_id: newId }).eq("mother_id", id);
        await supabase.from("farm_livestock").update({ father_id: newId }).eq("father_id", id);
        await supabase.from("farm_livestock").delete().eq("id", id);
      } else {
        const { error: updateError } = await supabase.from("farm_livestock").update({
          name: body.name ? String(body.name) : null,
          date_of_birth: body.dateOfBirth ? String(body.dateOfBirth) : null,
          updated_by: actor,
          updated_at: new Date().toISOString(),
        }).eq("id", id);
        if (updateError) throw updateError;
      }

      if (body.comment) {
        await supabase.from("farm_comments").insert({
          livestock_id: newId,
          comment: String(body.comment),
          author: actor,
        });
      }
      await logAudit(supabase, { action: "animal_edited", livestock_id: newId, actor, detail: `${id} -> ${newId}`, source: "owner" });
      return json(200, { ok: true, id: newId });
    }

    if (action === "upsertSmallStockRegistry") {
      const species = normalizeSpecies(body.species);
      const source = String(body.source ?? "owner panel");
      const note = String(body.note ?? "").trim();
      const tags = Array.isArray(body.tags)
        ? [...new Set(body.tags.map((x) => String(x).trim()).filter(Boolean))]
        : [];
      if (!species) return json(400, { ok: false, error: "Missing species" });
      if (!tags.length) return json(400, { ok: false, error: "Missing tags" });

      const { data: existingRows, error: existingError } = await supabase
        .from("farm_smallstock_registry")
        .select("tag_id")
        .eq("species", species)
        .in("tag_id", tags);
      if (existingError) throw existingError;

      const existing = new Set((existingRows ?? []).map((r) => String(r.tag_id)));
      const addedTags = tags.filter((tag) => !existing.has(tag));
      if (addedTags.length) {
        const rows = addedTags.map((tag) => ({
          tag_id: tag,
          species,
          is_active: true,
          note: note || null,
          created_by: actor,
          updated_by: actor,
          source,
        }));
        const { error: insertError } = await supabase.from("farm_smallstock_registry").insert(rows);
        if (insertError) throw insertError;
      }

      await logAudit(supabase, {
        action: "smallstock_registry_upsert",
        actor,
        source: species,
        detail: `${species}:${tags.join(",")}`,
      });

      if (addedTags.length) {
        const label = speciesLabel(species);
        const text = [
          `Khumotaka new ${label.toLowerCase()} registry entries`,
          `Species: ${label}`,
          `Added by: ${actor}`,
          `Source: ${source}`,
          `New tags: ${addedTags.join(", ")}`,
          ...(note ? [`Note: ${note}`] : []),
        ].join("\n");
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
            <h2 style="margin-bottom:8px">Khumotaka new ${label} registry entries</h2>
            <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
              <tr><td><b>Species</b></td><td>${label}</td></tr>
              <tr><td><b>Added by</b></td><td>${actor}</td></tr>
              <tr><td><b>Source</b></td><td>${source}</td></tr>
              <tr><td><b>New tags</b></td><td>${addedTags.join(", ")}</td></tr>
              ${note ? `<tr><td><b>Note</b></td><td>${note}</td></tr>` : ""}
            </table>
          </div>
        `;
        const mailResult = await sendResendEmail({
          subject: `Khumotaka new ${label.toLowerCase()} entries (${addedTags.length})`,
          text,
          html,
        });
        if (!mailResult.ok) {
          console.error("[farm-admin] small stock new entry email not sent", species, mailResult.reason);
        }
      }

      return json(200, {
        ok: true,
        species,
        added_tags: addedTags,
        existing_tags: tags.filter((tag) => existing.has(tag)),
      });
    }

    if (action === "addComment") {
      const livestockId = body.livestockId ? String(body.livestockId) : null;
      const comment = String(body.comment ?? "").trim();
      if (!comment) return json(400, { ok: false, error: "Missing comment" });
      const { error } = await supabase.from("farm_comments").insert({
        livestock_id: livestockId,
        comment,
        author: actor,
      });
      if (error) throw error;
      await logAudit(supabase, { action: "comment", livestock_id: livestockId, actor, detail: comment.slice(0, 120), source: "owner" });
      return json(200, { ok: true });
    }

    if (action === "getComments") {
      const livestockId = String(body.livestockId ?? "").trim();
      if (!livestockId) return json(200, { ok: true, comments: [] });
      const { data, error } = await supabase
        .from("farm_comments")
        .select("comment,author,created_at")
        .eq("livestock_id", livestockId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(200, { ok: true, comments: data ?? [] });
    }

    if (action === "getAudit") {
      const { data, error } = await supabase
        .from("farm_audit")
        .select("action,livestock_id,detail,actor,source,ts")
        .order("ts", { ascending: false })
        .limit(250);
      if (error) throw error;
      return json(200, { ok: true, events: data ?? [] });
    }

    if (action === "deleteAttendance") {
      const date = String(body.date ?? "");
      if (!date) return json(400, { ok: false, error: "Missing date" });
      const { error } = await supabase.from("farm_attendance").delete().eq("date", date);
      if (error) throw error;
      await logAudit(supabase, { action: "attendance_deleted", actor, detail: date, source: "owner" });
      return json(200, { ok: true });
    }

    if (action === "clearHealth") {
      const scope = String(body.scope ?? "all");
      let query = supabase.from("farm_health").delete();
      if (scope === "sick") query = query.eq("sick", true);
      else if (scope === "dead") query = query.eq("dead", true);
      const { error } = await query;
      if (error) throw error;
      await logAudit(supabase, { action: "health_cleared", actor, detail: scope, source: "owner" });
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    console.error("[farm-admin]", error);
    return new Response(JSON.stringify({ ok: false, error: String(error instanceof Error ? error.message : error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
