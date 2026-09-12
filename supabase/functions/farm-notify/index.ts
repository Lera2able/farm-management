import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, handleOptions, json, readJson } from "../_shared/helpers.ts";

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readJson(req) as Record<string, unknown>;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const toList = (Deno.env.get("FARM_NOTIFY_TO") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const fromEmail = Deno.env.get("FARM_NOTIFY_FROM") ?? "Khumotaka <onboarding@resend.dev>";

    if (!resendKey) return json(200, { ok: false, sent: false, reason: "RESEND_API_KEY is not configured" });
    if (!toList.length) return json(200, { ok: false, sent: false, reason: "FARM_NOTIFY_TO is not configured" });

    const date = String(body.date ?? "");
    const shepherd = String(body.shepherd ?? "Modisa");
    const present = Number(body.present ?? 0);
    const absent = Number(body.absent ?? 0);
    const total = Number(body.total ?? 0);
    const percentage = String(body.percentage ?? "");
    const comment = String(body.comment ?? "").trim();

    const text = [
      "Khumotaka attendance summary",
      `Date: ${date}`,
      `Shepherd: ${shepherd}`,
      `Present: ${present}`,
      `Absent: ${absent}`,
      `Total active: ${total}`,
      `Attendance: ${percentage}%`,
      ...(comment ? [`Comment: ${comment}`] : []),
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin-bottom:8px">Khumotaka attendance summary</h2>
        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
          <tr><td><b>Date</b></td><td>${date}</td></tr>
          <tr><td><b>Shepherd</b></td><td>${shepherd}</td></tr>
          <tr><td><b>Present</b></td><td>${present}</td></tr>
          <tr><td><b>Absent</b></td><td>${absent}</td></tr>
          <tr><td><b>Total active</b></td><td>${total}</td></tr>
          <tr><td><b>Attendance</b></td><td>${percentage}%</td></tr>
          ${comment ? `<tr><td><b>Comment</b></td><td>${comment}</td></tr>` : ""}
        </table>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toList,
        subject: `Khumotaka attendance: ${date || "today"}`,
        text,
        html,
      }),
    });

    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return json(200, {
        ok: false,
        sent: false,
        reason: payload?.message ?? `HTTP ${resp.status}`,
      });
    }

    return json(200, { ok: true, sent: true, id: payload?.id ?? null });
  } catch (error) {
    console.error("[farm-notify]", error);
    return new Response(JSON.stringify({ ok: false, sent: false, reason: String(error instanceof Error ? error.message : error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
