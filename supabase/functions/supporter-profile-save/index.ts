import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cors(req: Request) {
  const origin = req.headers.get("origin") || "https://osurtoartificial.com.br";
  const allowed = origin === "https://osurtoartificial.com.br" || origin === "https://www.osurtoartificial.com.br" || origin === "https://o-surto-artificial.vercel.app" || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://osurtoartificial.com.br", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Vary": "Origin" };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const auth = req.headers.get("Authorization");
  if (!auth) return json(req, { error: "Sessão obrigatória" }, 401);
  const client = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return json(req, { error: "Sessão inválida" }, 401);

  const admin = createClient(URL, SERVICE);
  const { data: paidSupport } = await admin.from("supports").select("id").eq("user_id", user.id).eq("payment_status", "paid").limit(1).maybeSingle();
  if (!paidSupport) return json(req, { error: "Seu perfil será liberado após a confirmação do pagamento", code: "payment_required" }, 403);

  let payload: any = {};
  try { payload = await req.json(); } catch { return json(req, { error: "Dados inválidos" }, 400); }
  const displayName = String(payload.displayName || "").trim();
  const socialNetwork = String(payload.socialNetwork || "").trim().toLowerCase();
  const socialHandle = String(payload.socialHandle || "").trim().replace(/^@/, "");
  const socialUrl = String(payload.socialUrl || "").trim();
  const notificationEmail = String(payload.notificationEmail || user.email || "").trim().toLowerCase();
  const publicConsent = !!payload.publicConsent;
  if (!displayName) return json(req, { error: "Informe o nome de divulgação" }, 400);
  if (!["instagram", "tiktok", "youtube", "x", "facebook", "outro"].includes(socialNetwork)) return json(req, { error: "Rede social inválida" }, 400);
  if (!socialHandle) return json(req, { error: "Informe o @ ou usuário" }, 400);
  if (socialUrl && !/^https:\/\//i.test(socialUrl)) return json(req, { error: "Quando informado, o link deve começar com https://" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) return json(req, { error: "Informe um e-mail válido" }, 400);
  if (!publicConsent) return json(req, { error: "Autorize a divulgação para continuar" }, 400);

  const { data: existing } = await admin.from("publicity_profiles").select("submission_completed_at").eq("user_id", user.id).maybeSingle();
  if (existing?.submission_completed_at) return json(req, { error: "Seu material já foi concluído e está em modo de visualização" }, 409);
  const { data, error } = await admin.from("publicity_profiles").upsert({ user_id: user.id, display_name: displayName, social_network: socialNetwork, social_handle: socialHandle, social_url: socialUrl || null, notification_email: notificationEmail, public_consent: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select().single();
  if (error) return json(req, { error: "Não foi possível salvar o perfil" }, 500);
  return json(req, { ok: true, profile: data });
});
