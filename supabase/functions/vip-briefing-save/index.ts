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

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Método não permitido" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(req, { error: "Sessão obrigatória" }, 401);

  const client = createClient(URL, ANON, { global: { headers: { Authorization: authorization } } });
  const { data: userData } = await client.auth.getUser(authorization.slice(7));
  const user = userData.user;
  if (!user) return json(req, { error: "Sessão inválida" }, 401);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const [{ data: vipSupport }, { data: profile }] = await Promise.all([
    admin.from("supports").select("id").eq("user_id", user.id).eq("payment_status", "paid").eq("tier", "vip").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("publicity_profiles").select("display_name,social_network,social_handle,notification_email,public_consent").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!vipSupport) return json(req, { error: "A Área VIP é exclusiva para apoiadores VIP com pagamento confirmado" }, 403);
  const profileReady = !!(profile?.display_name && profile?.social_network && profile?.social_handle && profile?.notification_email && profile?.public_consent);
  if (!profileReady) return json(req, { error: "Preencha primeiro o seu Perfil de Divulgação" }, 403);

  const body = await req.json().catch(() => ({}));
  const promotionGoal = clean(body.promotionGoal, 1000);
  const sceneIdea = clean(body.sceneIdea, 4000);
  const termsAccepted = body.termsAccepted === true;
  const imagePaths = Array.isArray(body.referenceImagePaths)
    ? [...new Set(body.referenceImagePaths.map((path: unknown) => clean(path, 600)).filter(Boolean))]
    : [];
  if (promotionGoal.length < 3) return json(req, { error: "Conte o que você deseja divulgar" }, 400);
  if (sceneIdea.length < 20) return json(req, { error: "Descreva um pouco mais como você imagina sua cena" }, 400);
  if (!termsAccepted) return json(req, { error: "Confirme que entendeu o formato da participação VIP" }, 400);
  if (imagePaths.length > 3) return json(req, { error: "Envie no máximo três imagens de referência" }, 400);

  const imageFolder = `${user.id}/${vipSupport.id}`;
  if (imagePaths.some((path) => !path.startsWith(`${imageFolder}/`) || path.slice(imageFolder.length + 1).includes("/"))) {
    return json(req, { error: "Uma das imagens enviadas é inválida" }, 400);
  }
  if (imagePaths.length) {
    const { data: stored, error: listError } = await admin.storage.from("vip-briefing-images").list(imageFolder, { limit: 100 });
    const storedNames = new Set((stored || []).map((file) => file.name));
    if (listError || imagePaths.some((path) => !storedNames.has(path.slice(imageFolder.length + 1)))) {
      return json(req, { error: "Não foi possível confirmar todas as imagens enviadas" }, 400);
    }
  }

  const now = new Date().toISOString();
  const { data: previous } = await admin.from("vip_briefings").select("reference_image_paths").eq("support_id", vipSupport.id).maybeSingle();
  const { data, error } = await admin.from("vip_briefings").upsert({
    user_id: user.id,
    support_id: vipSupport.id,
    promotion_goal: promotionGoal,
    scene_idea: sceneIdea,
    product_or_material: null,
    additional_notes: null,
    reference_image_paths: imagePaths,
    terms_accepted: true,
    status: "submitted",
    submitted_at: now,
    updated_at: now,
  }, { onConflict: "support_id" }).select().single();
  if (error) {
    console.error("vip-briefing-save", error);
    return json(req, { error: "Não foi possível salvar o briefing agora" }, 500);
  }
  const stalePaths = (previous?.reference_image_paths || []).filter((path: string) => !imagePaths.includes(path));
  if (stalePaths.length) await admin.storage.from("vip-briefing-images").remove(stalePaths);
  return json(req, { ok: true, briefing: data });
});
