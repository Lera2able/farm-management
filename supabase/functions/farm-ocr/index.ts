import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
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
    const image = String(body.image ?? "");
    const mediaType = String(body.mediaType ?? "image/jpeg");
    if (!token) return json(401, { ok: false, code: "AUTH", error: "Not logged in" });
    if (!image) return json(400, { ok: false, error: "Missing image" });

    const supabase = getAdminClient();
    const session = await loadSession(supabase, token);
    if (!session) return json(401, { ok: false, code: "AUTH", error: "Not logged in" });

    const apiKey = mustEnv("OPENAI_API_KEY");
    const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
    const model = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4.1-mini";

    const prompt = [
      "Read the livestock sheet image.",
      "Return only JSON with this shape:",
      '{"numbers":["11201"],"date":"YYYY-MM-DD"}.',
      "Numbers must be strings, unique, and keep letters if present.",
      "If no valid date is visible, return date as null.",
      "Do not add explanation.",
    ].join(" ");

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${image}` } },
            ],
          },
        ],
      }),
    });

    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return json(200, { ok: false, error: payload?.error?.message ?? `HTTP ${resp.status}` });
    }

    const text = payload?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(text);
    const numbers = Array.isArray(parsed?.numbers)
      ? [...new Set(parsed.numbers.map((x: unknown) => String(x).trim()).filter(Boolean))]
      : [];
    const date = typeof parsed?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;

    return json(200, { ok: true, numbers, date });
  } catch (error) {
    console.error("[farm-ocr]", error);
    return new Response(JSON.stringify({ ok: false, error: String(error instanceof Error ? error.message : error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
