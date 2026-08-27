import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rank: Record<string, number> = { free: 0, supporter: 1, highlight: 2, vip: 3 };
const labels: Record<string, string> = { free: "Apoio Livre", supporter: "Apoiador", highlight: "Apoiador Destaque", vip: "Apoiador VIP" };
const mins: Record<string, number> = { free: 1, supporter: 50, highlight: 100, vip: 300 };

function cors(req: Request) {
  const origin = req.headers.get("origin") || "https://osurtoartificial.com.br";
  const allowed = origin === "https://osurtoartificial.com.br" || origin === "https://www.osurtoartificial.com.br" || origin === "https://o-surto-artificial.vercel.app" || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://osurtoartificial.com.br", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Vary": "Origin" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "Sessão obrigatória" }), { status: 401, headers: cors(req) });
  const client = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: ud } = await client.auth.getUser();
  const user = ud.user;
  if (!user) return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: cors(req) });
  const admin = createClient(URL, SERVICE);

  const [{ data: profile }, { data: supports }, { data: subscriptions }, { data: publicity }, { data: vipBriefings }] = await Promise.all([
    admin.from("profiles").select("id,display_name,created_at,status").eq("id", user.id).maybeSingle(),
    admin.from("supports").select("id,production_id,tier,billing_mode,amount,payment_status,paid_at,created_at,provider_payment_id,upgrade_from_support_id,upgrade_credit_amount").eq("user_id", user.id).eq("payment_status", "paid").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("id,tier,amount,status,next_due_date,started_at,cancelled_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    admin.from("publicity_profiles").select("display_name,social_network,social_handle,social_url,notification_email,source_photo_path,face_photo_path,body_photo_path,official_avatar_path,public_consent,information_confirmed_at,submission_completed_at,avatar_status,created_at,updated_at").eq("user_id", user.id).maybeSingle(),
    admin.from("vip_briefings").select("id,support_id,promotion_goal,scene_idea,product_or_material,additional_notes,status,submitted_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
  ]);
  const paidSupports = supports || [];
  const effective = paidSupports.slice().sort((a: any, b: any) => (rank[b.tier] - rank[a.tier]) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))[0] || null;
  const currentTier = effective?.tier || null;
  const currentCredit = currentTier ? Math.min(Number(effective.amount || 0), mins[currentTier] || 0) : 0;
  const ids = paidSupports.map((s: any) => s.id);
  let appearances: any[] = [];
  if (ids.length) {
    const { data } = await admin.from("appearances").select("id,support_id,episode_id,status,queue_priority,estimated_episode_number,estimated_date,confirmed_at,published_at,published_url,created_at,episodes(episode_number,scheduled_date,published_at,instagram_url,tiktok_url,youtube_url,cover_image_url)").in("support_id", ids).order("created_at", { ascending: false });
    appearances = data || [];
  }
  const realEpisodes = appearances.filter((a: any) => a.status === "published" || a.published_at || a.episodes?.published_at).map((a: any) => ({
    appearanceId: a.id,
    episodeNumber: a.episodes?.episode_number || a.estimated_episode_number || null,
    date: a.episodes?.published_at || a.published_at || a.episodes?.scheduled_date || null,
    coverImageUrl: a.episodes?.cover_image_url || null,
    instagramUrl: a.episodes?.instagram_url || null,
    tiktokUrl: a.episodes?.tiktok_url || null,
    youtubeUrl: a.episodes?.youtube_url || a.published_url || null,
  }));
  const activeSubscription = (subscriptions || []).find((s: any) => ["active", "pending"].includes(s.status)) || null;
  const upgrades = ["supporter", "highlight", "vip"].map(t => ({ tier: t, label: labels[t], fullPrice: mins[t], available: !currentTier || rank[t] > rank[currentTier], amountDue: Math.max(0, mins[t] - currentCredit) }));
  return new Response(JSON.stringify({
    ok: true,
    user: { id: user.id, email: user.email, displayName: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Apoiador", memberSince: profile?.created_at || user.created_at },
    currentSupport: effective ? { ...effective, label: labels[effective.tier] || effective.tier } : null,
    supports: paidSupports.map((s: any) => ({ ...s, label: labels[s.tier] || s.tier })),
    subscription: activeSubscription,
    subscriptions: subscriptions || [],
    publicityProfile: publicity || null,
    appearances,
    episodes: realEpisodes,
    vipAccess: currentTier === "vip",
    vipBriefing: effective?.tier === "vip" ? (vipBriefings || []).find((briefing: any) => briefing.support_id === effective.id) || null : null,
    currentTier,
    currentCredit,
    upgrades,
  }), { headers: cors(req) });
});
