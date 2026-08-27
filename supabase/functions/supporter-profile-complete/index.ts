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

  const { data: profile, error } = await admin.from("publicity_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error || !profile) return json(req, { error: "Complete seu perfil antes de concluir" }, 400);
  if (profile.submission_completed_at) return json(req, { ok: true, profile, alreadyCompleted: true });
  const required = [profile.display_name, profile.social_network, profile.social_handle, profile.social_url, profile.notification_email, profile.face_photo_path, profile.body_photo_path];
  if (required.some(value => !value) || !profile.public_consent) return json(req, { error: "Preencha o perfil e envie as duas fotos antes de concluir" }, 400);
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin.from("publicity_profiles").update({ submission_completed_at: now, avatar_status: profile.official_avatar_path ? "ready" : "awaiting", updated_at: now }).eq("user_id", user.id).select().single();
  if (updateError) return json(req, { error: "Não foi possível concluir seu envio agora" }, 500);
  return json(req, { ok: true, profile: updated });
});
