import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_URL = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com/v3";
const SANDBOX = ASAAS_URL.includes("sandbox");
const rank: Record<string, number> = { free: 0, supporter: 1, highlight: 2, vip: 3 };
const origins = new Set(["https://osurtoartificial.com.br", "https://www.osurtoartificial.com.br", "https://o-surto-artificial.vercel.app"]);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = origins.has(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://osurtoartificial.com.br", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
function json(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } }); }
function dueDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 172800000)); }
async function asaas(path: string, init: RequestInit = {}) {
  const response = await fetch(`${ASAAS_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", "User-Agent": "O-Surto-Artificial/2.0", access_token: ASAAS_KEY, ...(init.headers || {}) } });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) { const error: any = new Error(`Asaas API error ${response.status}`); error.status = response.status; error.data = data; throw error; }
  return data;
}
async function pix(paymentId: string) {
  let last: any;
  for (const delay of [0, 500, 900, 1400, 2200, 3200, 4500]) {
    if (delay) await sleep(delay);
    try { return await asaas(`/payments/${paymentId}/pixQrCode`, { method: "GET" }); }
    catch (error: any) { last = error; const waiting = error?.status === 400 && error?.data?.errors?.some((x: any) => x.code === "invalid_action"); if (!waiting) throw error; }
  }
  throw last;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Método não permitido" }, 405);
  if (!ASAAS_KEY) return json(req, { error: "Pagamento ainda não configurado" }, 500);
  const auth = req.headers.get("Authorization");
  if (!auth) return json(req, { error: "Sessão obrigatória" }, 401);
  const client = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: ud } = await client.auth.getUser();
  const user = ud.user;
  if (!user) return json(req, { error: "Sessão inválida ou expirada" }, 401);
  const body = await req.json().catch(() => ({}));
  const tier = String(body.tier || "");
  const method = String(body.method || "pix").toLowerCase();
  const isPix = method === "pix";
  const isCard = ["cartao", "card", "credit_card"].includes(method);
  const upgradeFromSupportId = body.upgradeFromSupportId ? String(body.upgradeFromSupportId) : null;
  if (!(tier in rank)) return json(req, { error: "Plano inválido" }, 400);
  if (!isPix && !isCard) return json(req, { error: "Forma de pagamento inválida" }, 400);
  const admin = createClient(URL, SERVICE);
  const { data: plan } = await admin.from("support_plans").select("slug,name,minimum_amount,active").eq("slug", tier).maybeSingle();
  if (!plan?.active) return json(req, { error: "Plano indisponível" }, 400);
  const targetMinimum = Number(plan.minimum_amount);
  let chargeAmount = Number(body.amount);
  let credit = 0;
  let source: any = null;

  if (upgradeFromSupportId) {
    const { data } = await admin.from("supports").select("id,user_id,production_id,tier,amount,payment_status").eq("id", upgradeFromSupportId).eq("user_id", user.id).eq("payment_status", "paid").maybeSingle();
    source = data;
    if (!source) return json(req, { error: "Apoio atual não encontrado" }, 400);
    if (rank[tier] <= rank[String(source.tier)]) return json(req, { error: "Escolha uma categoria superior à atual" }, 400);
    credit = Math.min(Number(source.amount || 0), targetMinimum);
    chargeAmount = Math.max(0, targetMinimum - credit);
  } else {
    const { data: active } = await admin.from("supports").select("id,tier,amount").eq("user_id", user.id).eq("payment_status", "paid").in("tier", ["supporter", "highlight", "vip"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (active && tier !== "free") return json(req, { error: "Você já é apoiador. Escolha um upgrade na sua área.", code: "upgrade_required", currentSupport: active }, 409);
    if (!Number.isFinite(chargeAmount) || chargeAmount < targetMinimum) return json(req, { error: `O valor mínimo para ${plan.name} é R$ ${targetMinimum.toFixed(2).replace(".", ",")}` }, 400);
  }

  const productionId = source?.production_id || (await admin.from("productions").select("id").in("status", ["airing", "final_weeks"]).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.id || null;
  if (upgradeFromSupportId && chargeAmount === 0) {
    const now = new Date().toISOString();
    const { data: covered, error } = await admin.from("supports").insert({ user_id: user.id, production_id: productionId, tier, billing_mode: "one_time", minimum_amount: 0, amount: 0, payment_status: "paid", payment_provider: "upgrade_credit", paid_at: now, upgrade_from_support_id: source.id, upgrade_credit_amount: credit }).select("id").single();
    if (error) return json(req, { error: "Não foi possível concluir o upgrade" }, 500);
    return json(req, { ok: true, alreadyCovered: true, supportId: covered.id, amount: 0, targetTier: tier, credit });
  }

  const { data: support, error: supportError } = await admin.from("supports").insert({
    user_id: user.id,
    production_id: productionId,
    tier,
    billing_mode: "one_time",
    minimum_amount: upgradeFromSupportId ? chargeAmount : targetMinimum,
    amount: chargeAmount,
    payment_status: "pending",
    payment_provider: "asaas",
    upgrade_from_support_id: source?.id || null,
    upgrade_credit_amount: credit,
  }).select("id").single();
  if (supportError || !support) return json(req, { error: "Não foi possível iniciar o apoio" }, 500);

  let stage = "customer";
  try {
    const existing = await asaas(`/customers?externalReference=${encodeURIComponent(user.id)}&limit=1`, { method: "GET" });
    let customerId = existing?.data?.[0]?.id;
    const cpf = String(body.cpfCnpj || (SANDBOX ? "24971563792" : "")).replace(/\D/g, "");
    if (!cpf) return json(req, { error: "CPF/CNPJ é obrigatório" }, 400);
    const customer = { name: String(body.fullName || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Apoiador"), cpfCnpj: cpf, email: user.email, externalReference: user.id, notificationDisabled: true };
    if (!customerId) customerId = (await asaas("/customers", { method: "POST", body: JSON.stringify(customer) })).id;
    else await asaas(`/customers/${customerId}`, { method: "PUT", body: JSON.stringify(customer) });
    stage = "payment";
    const payment = await asaas("/payments", { method: "POST", body: JSON.stringify({ customer: customerId, billingType: isPix ? "PIX" : "CREDIT_CARD", value: chargeAmount, dueDate: dueDate(), description: upgradeFromSupportId ? `O Surto Artificial — Upgrade para ${plan.name}` : `O Surto Artificial — ${plan.name}`, externalReference: support.id }) });
    await admin.from("supports").update({ provider_payment_id: payment.id, provider_checkout_id: payment.invoiceUrl || null, external_reference: support.id }).eq("id", support.id);
    if (isCard) {
      if (!payment.invoiceUrl) throw new Error("Asaas não retornou o link seguro do cartão");
      return json(req, { ok: true, sandbox: SANDBOX, supportId: support.id, paymentId: payment.id, invoiceUrl: payment.invoiceUrl, status: payment.status, amount: chargeAmount, plan: plan.name, upgrade: !!upgradeFromSupportId, sourceSupportId: source?.id || null, targetMinimum, credit, paymentMethod: "credit_card" });
    }
    stage = "pix";
    const qr = await pix(payment.id);
    return json(req, { ok: true, sandbox: SANDBOX, supportId: support.id, paymentId: payment.id, invoiceUrl: payment.invoiceUrl, status: payment.status, amount: chargeAmount, plan: plan.name, upgrade: !!upgradeFromSupportId, sourceSupportId: source?.id || null, targetMinimum, credit, pix: { encodedImage: qr.encodedImage, payload: qr.payload, expirationDate: qr.expirationDate } });
  } catch (error: any) {
    await admin.from("supports").update({ payment_status: "failed", external_reference: support.id }).eq("id", support.id);
    await admin.from("payment_debug_events").insert({ support_id: support.id, user_id: user.id, stage, http_status: error?.status || null, error_data: error?.data || { message: error?.message } });
    return json(req, { error: "Não foi possível criar a cobrança agora", stage }, 502);
  }
});
