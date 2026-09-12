import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function groupForId(id: string) {
  const s = String(id ?? "");
  if (s.startsWith("11")) return "11";
  if (s.startsWith("55")) return "55";
  if (s.startsWith("56")) return "56";
  if (s.startsWith("58")) return "58";
  if (s.startsWith("72")) return "72";
  if (/^[A-Za-z]/.test(s)) return "special";
  return "other";
}

export async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string) {
  const pepper = Deno.env.get("FARM_PASSWORD_PEPPER") ?? "";
  return await sha256Hex(`${pepper}:${password}`);
}

export async function hashToken(token: string) {
  return await sha256Hex(`farm-session:${token}`);
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureBootstrapUser(supabase: ReturnType<typeof createClient>) {
  const { count, error } = await supabase
    .from("farm_owner_users")
    .select("name", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const password = Deno.env.get("FARM_BOOTSTRAP_PASSWORD");
  if (!password) return;
  const name = Deno.env.get("FARM_BOOTSTRAP_NAME") ?? "Khumotaka Owner";
  const role = Deno.env.get("FARM_BOOTSTRAP_ROLE") === "super" ? "super" : "supersuper";
  const passwordHash = await hashPassword(password);
  const { error: insertError } = await supabase.from("farm_owner_users").insert({
    name,
    role,
    password_hash: passwordHash,
    is_active: true,
  });
  if (insertError && !String(insertError.message ?? "").toLowerCase().includes("duplicate")) {
    throw insertError;
  }
}

export async function loadSession(supabase: ReturnType<typeof createClient>, token: string | null | undefined) {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const { data, error } = await supabase
    .from("farm_owner_sessions")
    .select("token_hash,user_name,role,expires_at,is_revoked")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.is_revoked) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return { name: data.user_name, role: data.role, tokenHash };
}

export async function requireSession(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  requireRole: "super" | "supersuper" = "super",
) {
  const session = await loadSession(supabase, String(body.token ?? ""));
  if (!session) return { ok: false as const, response: json(401, { ok: false, code: "AUTH", error: "Not logged in" }) };
  if (requireRole === "supersuper" && session.role !== "supersuper") {
    return { ok: false as const, response: json(403, { ok: false, error: "Not allowed" }) };
  }
  return { ok: true as const, session };
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function logAudit(
  supabase: ReturnType<typeof createClient>,
  event: {
    action: string;
    livestock_id?: string | null;
    detail?: string | null;
    actor?: string | null;
    source?: string | null;
  },
) {
  await supabase.from("farm_audit").insert({
    action: event.action,
    livestock_id: event.livestock_id ?? null,
    detail: event.detail ?? null,
    actor: event.actor ?? null,
    source: event.source ?? null,
  });
}

export function mustEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function extractJsonObject(text: string) {
  const trimmed = String(text ?? "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found");
    return JSON.parse(match[0]);
  }
}

export function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
