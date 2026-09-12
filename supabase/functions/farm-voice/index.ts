import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  decodeBase64,
  extractJsonObject,
  getAdminClient,
  handleOptions,
  json,
  loadSession,
  mustEnv,
  readJson,
} from "../_shared/helpers.ts";

serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const body = await readJson(req) as Record<string, unknown>;
    const token = String(body.token ?? "");
    const audio = String(body.audio ?? "");
    const mediaType = String(body.mediaType ?? "audio/m4a");
    if (!token) return json(401, { ok: false, code: "AUTH", error: "Not logged in" });
    if (!audio) return json(400, { ok: false, error: "Missing audio" });

    const supabase = getAdminClient();
    const session = await loadSession(supabase, token);
    if (!session) return json(401, { ok: false, code: "AUTH", error: "Not logged in" });

    const apiKey = mustEnv("OPENAI_API_KEY");
    const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
    const transcribeModel = Deno.env.get("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe";
    const textModel = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-4.1-mini";

    const form = new FormData();
    form.append("model", transcribeModel);
    form.append("file", new Blob([decodeBase64(audio)], { type: mediaType }), "recording.webm");

    const trResp = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const trPayload = await trResp.json().catch(() => ({}));
    if (!trResp.ok) {
      return json(200, { ok: false, error: trPayload?.error?.message ?? `HTTP ${trResp.status}` });
    }

    const transcript = String(trPayload?.text ?? "").trim();
    if (!transcript) return json(200, { ok: true, transcript: "", numbers: [], date: null });

    const prompt = [
      "Extract livestock numbers and an optional date from this transcript.",
      "Return only JSON shaped as:",
      '{"numbers":["11201"],"date":"YYYY-MM-DD"}.',
      "Keep numbers as strings. Remove duplicates.",
      "If there is no reliable date, return date as null.",
      `Transcript: ${transcript}`,
    ].join(" ");

    const llmResp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: textModel,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const llmPayload = await llmResp.json().catch(() => ({}));
    if (!llmResp.ok) {
      return json(200, { ok: false, error: llmPayload?.error?.message ?? `HTTP ${llmResp.status}` });
    }

    const content = llmPayload?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content);
    const numbers = Array.isArray(parsed?.numbers)
      ? [...new Set(parsed.numbers.map((x: unknown) => String(x).trim()).filter(Boolean))]
      : [];
    const date = typeof parsed?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;

    return json(200, { ok: true, transcript, numbers, date });
  } catch (error) {
    console.error("[farm-voice]", error);
    return new Response(JSON.stringify({ ok: false, error: String(error instanceof Error ? error.message : error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
