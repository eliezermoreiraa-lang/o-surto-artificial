import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]!));
const frame = (title: string, message: string) => `<!doctype html><html><body style="margin:0;background:#0b0d13;color:#f5f5f5;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:42px 24px"><div style="font-size:12px;letter-spacing:.18em;color:#00e5ff">O SURTO ARTIFICIAL</div><h1 style="font-size:32px;line-height:1.1;margin:16px 0;color:#fff">${esc(title)}</h1><div style="font-size:16px;line-height:1.7;color:#d6d7dc">${esc(message).replace(/\n/g,"<br>")}</div><a href="https://osurtoartificial.com.br" style="display:inline-block;margin-top:24px;padding:14px 22px;border-radius:8px;background:#e50914;color:#fff;text-decoration:none;font-weight:700">ABRIR O CLUBE DO SURTO</a><div style="margin-top:38px;padding-top:20px;border-top:1px solid #292c35;font-size:12px;color:#858995">Clube do Surto · osurtoartificial.com.br</div></div></body></html>`;

async function secret(name: string) {
  const { data, error } = await admin.rpc("get_runtime_secret", { p_name: name });
  if (error || !data) throw new Error(`missing ${name}`);
  return String(data);
}

function content(event: any) {
  if (event.event_type === "thank_you") return ["Seu apoio chegou. Obrigado!", event.message || "Seu apoio foi confirmado e já faz parte do que mantém nossas novelinhas vivas. Acompanhe sua jornada, envie suas informações e veja as próximas atualizações na Área do Apoiador."];
  if (event.event_type === "renewal_reminder") return ["O Surto continua com você", event.message || "Já se passaram 30 dias desde o seu último apoio. Ele foi muito importante para colocar nossas produções no ar. Se puder, apoie novamente e continue fazendo parte das próximas novelinhas."];
  if (event.event_type === "info_request") return ["Precisamos das suas informações", event.message || "Seu apoio foi confirmado, mas ainda faltam informações ou imagens para continuarmos a produção do seu avatar. Entre na Área do Apoiador e conclua o Perfil de Divulgação."];
  return [event.subject, event.message || "A produção do Surto tem uma atualização para você."];
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method" }), { status: 405, headers: { "Content-Type":"application/json" } });
  try {
    const [cronSecret, resendKey] = await Promise.all([secret("email_cron_secret"), secret("resend_api_key")]);
    if (req.headers.get("x-surto-cron-secret") !== cronSecret) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type":"application/json" } });
    const { data: queuedCount } = await admin.rpc("queue_due_renewal_reminders");
    const { data: events, error } = await admin.from("supporter_email_events").select("*").in("status", ["queued","failed"]).lt("attempts", 3).order("queued_at").limit(25);
    if (error) throw error;
    let sent = 0, failed = 0;
    for (const event of events || []) {
      await admin.from("supporter_email_events").update({ status:"sending", attempts:Number(event.attempts || 0)+1, updated_at:new Date().toISOString() }).eq("id", event.id);
      const [title, message] = content(event);
      const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ "Authorization":`Bearer ${resendKey}`, "Content-Type":"application/json", "Idempotency-Key":event.idempotency_key }, body:JSON.stringify({ from:"O Surto Artificial <clube@osurtoartificial.com.br>", to:[event.recipient_email], reply_to:"osurtoartificial@gmail.com", subject:event.subject, html:frame(title,message) }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        sent++;
        await admin.from("supporter_email_events").update({ status:"sent", provider_message_id:body.id || null, sent_at:new Date().toISOString(), last_error:null, updated_at:new Date().toISOString() }).eq("id",event.id);
      } else {
        failed++;
        await admin.from("supporter_email_events").update({ status:"failed", last_error:String(body?.message || `Resend ${response.status}`).slice(0,800), updated_at:new Date().toISOString() }).eq("id",event.id);
      }
    }
    return new Response(JSON.stringify({ ok:true, queued:queuedCount || 0, processed:(events || []).length, sent, failed }), { headers:{ "Content-Type":"application/json" } });
  } catch (error) {
    console.error("supporter-email-processor", error);
    return new Response(JSON.stringify({ error:error instanceof Error ? error.message : "processor failed" }), { status:500, headers:{ "Content-Type":"application/json" } });
  }
});
