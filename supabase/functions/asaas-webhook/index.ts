import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_PRODUCTION_WEBHOOK_TOKEN") || "";
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const RANK: Record<string, number> = { free: 0, supporter: 1, highlight: 2, vip: 3 };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mapEventToPaymentStatus(event: string) {
  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) return "paid";
  if (["PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS"].includes(event)) return "refunded";
  if (["PAYMENT_DELETED"].includes(event)) return "cancelled";
  if (["PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_REPROVED_BY_RISK_ANALYSIS"].includes(event)) return "failed";
  return null;
}

async function syncAppearanceForSupport(support: any, mappedStatus: string) {
  if (!support || !["supporter", "highlight", "vip"].includes(String(support.tier))) return;

  if (mappedStatus === "paid") {
    const priority = support.tier === "vip" ? 300 : support.tier === "highlight" ? 200 : 100;
    const { data: ownExisting } = await admin
      .from("appearances")
      .select("id")
      .eq("support_id", support.id)
      .maybeSingle();
    if (ownExisting) {
      await admin.from("appearances").update({ queue_priority: priority, updated_at: new Date().toISOString() }).eq("id", ownExisting.id);
      return;
    }

    // Upgrade: reutiliza a aparição ainda não publicada do plano inferior, evitando duplicidade na fila.
    const { data: olderSupports } = await admin
      .from("supports")
      .select("id,tier,created_at")
      .eq("user_id", support.user_id)
      .eq("production_id", support.production_id)
      .eq("payment_status", "paid")
      .neq("id", support.id)
      .order("created_at", { ascending: false });

    const lowerIds = (olderSupports || [])
      .filter((s: any) => (RANK[String(s.tier)] ?? -1) < (RANK[String(support.tier)] ?? -1))
      .map((s: any) => s.id);

    if (lowerIds.length) {
      const { data: reusable } = await admin
        .from("appearances")
        .select("id,status,support_id")
        .in("support_id", lowerIds)
        .not("status", "in", "(published,cancelled)")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (reusable) {
        const { error } = await admin.from("appearances").update({
          support_id: support.id,
          queue_priority: priority,
          updated_at: new Date().toISOString(),
        }).eq("id", reusable.id);
        if (error) console.error("appearance upgrade transfer error", error);
        return;
      }
    }

    const { error } = await admin.from("appearances").insert({
      support_id: support.id,
      status: "waiting_profile",
      queue_priority: priority,
    });
    if (error) console.error("appearance insert error", error);
    return;
  }

  if (["refunded", "cancelled", "failed"].includes(mappedStatus)) {
    const { error } = await admin
      .from("appearances")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("support_id", support.id)
      .neq("status", "published");
    if (error) console.error("appearance cancel error", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  if (!ASAAS_WEBHOOK_TOKEN) return response({ error: "Webhook token not configured" }, 500);

  const receivedToken = req.headers.get("asaas-access-token") || "";
  if (receivedToken !== ASAAS_WEBHOOK_TOKEN) return response({ error: "Unauthorized" }, 401);

  let payload: any;
  try { payload = await req.json(); }
  catch { return response({ error: "Invalid JSON" }, 400); }

  const eventId = String(payload?.id || "");
  const event = String(payload?.event || "");
  const payment = payload?.payment || {};
  const paymentId = payment?.id ? String(payment.id) : null;
  const externalReference = payment?.externalReference ? String(payment.externalReference) : null;
  if (!eventId || !event) return response({ error: "Invalid webhook payload" }, 400);

  const { data: existing } = await admin.from("asaas_webhook_events").select("id").eq("id", eventId).maybeSingle();
  if (existing) return response({ ok: true, duplicate: true });

  let support: any = null;
  if (externalReference) {
    const { data } = await admin
      .from("supports")
      .select("id,user_id,production_id,tier,payment_status")
      .eq("external_reference", externalReference)
      .maybeSingle();
    support = data;
  }
  if (!support && paymentId) {
    const { data } = await admin
      .from("supports")
      .select("id,user_id,production_id,tier,payment_status")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();
    support = data;
  }

  const mappedStatus = mapEventToPaymentStatus(event);
  if (support && mappedStatus) {
    const updateData: Record<string, unknown> = {
      payment_status: mappedStatus,
      updated_at: new Date().toISOString(),
    };
    if (mappedStatus === "paid") updateData.paid_at = payment?.confirmedDate || payment?.clientPaymentDate || new Date().toISOString();

    const { error: updateError } = await admin.from("supports").update(updateData).eq("id", support.id);
    if (updateError) return response({ error: "Could not update support" }, 500);
    await syncAppearanceForSupport(support, mappedStatus);
  }

  const { error: eventInsertError } = await admin.from("asaas_webhook_events").insert({
    id: eventId,
    event_type: event,
    payment_id: paymentId,
    support_id: support?.id || null,
    payload,
  });
  if (eventInsertError) {
    if ((eventInsertError as any).code === "23505") return response({ ok: true, duplicate: true });
    return response({ error: "Could not store webhook event" }, 500);
  }

  return response({ ok: true, processed: Boolean(support && mappedStatus) });
});
