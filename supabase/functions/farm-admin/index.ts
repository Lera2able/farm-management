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
      const { error } = await supabase.from("farm_livestock").upsert({
        id,
        group_name: body.group ? String(body.group) : groupForId(id),
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
      await logAudit(supabase, { action: "calf_added", livestock_id: id, actor, source: "owner" });
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
