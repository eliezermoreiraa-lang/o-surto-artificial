import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

function headers(req: Request) {
  const origin = req.headers.get("origin") || "https://osurtoartificial.com.br";
  const allowed = origin === "https://osurtoartificial.com.br" ||
    origin === "https://www.osurtoartificial.com.br" ||
    origin === "https://o-surto-artificial.vercel.app" ||
    origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://osurtoartificial.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function escapeHtml(value: unknown) {
  return cleanText(value, 10000).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]!));
}

function emailFrame(title: string, message: string, buttonLabel?: string) {
  const button = buttonLabel
    ? `<a href="https://osurtoartificial.com.br" style="display:inline-block;margin-top:24px;padding:14px 22px;border-radius:8px;background:#e50914;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(buttonLabel)}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0b0d13;color:#f5f5f5;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;padding:42px 24px"><div style="font-size:12px;letter-spacing:.18em;color:#00e5ff">O SURTO ARTIFICIAL</div><h1 style="font-size:32px;line-height:1.1;margin:16px 0;color:#fff">${escapeHtml(title)}</h1><div style="font-size:16px;line-height:1.7;color:#d6d7dc">${escapeHtml(message).replace(/\n/g, "<br>")}</div>${button}<div style="margin-top:38px;padding-top:20px;border-top:1px solid #292c35;font-size:12px;color:#858995">Clube do Surto · osurtoartificial.com.br</div></div></body></html>`;
}

async function requireAdmin(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const client = createClient(URL, ANON, { global: { headers: { Authorization: authorization } } });
  const token = authorization.slice(7);
  const { data: authData } = await client.auth.getUser(token);
  const user = authData.user;
  if (!user) return null;
  const { data: profile } = await admin.from("profiles").select("id,role,status").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" || profile?.status !== "active") return null;
  return user;
}

async function listAuthUsers() {
  const users: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if ((data.users || []).length < 1000) break;
  }
  return users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));
}

async function getSecret(name: string) {
  const { data, error } = await admin.rpc("get_runtime_secret", { p_name: name });
  if (error || !data) throw new Error(`Segredo ${name} não configurado`);
  return String(data);
}

async function sendQueuedEmail(event: any) {
  const key = await getSecret("resend_api_key");
  let title = event.subject;
  let message = event.message || "";
  let button = "ABRIR O CLUBE DO SURTO";
  if (event.event_type === "thank_you" && !message) {
    title = "Seu apoio chegou. Obrigado!";
    message = "Seu apoio foi confirmado e já faz parte do que mantém nossas novelinhas vivas. Acompanhe sua jornada, envie suas informações e veja as próximas atualizações na Área do Apoiador.";
  } else if (event.event_type === "renewal_reminder" && !message) {
    title = "O Surto continua com você";
    message = "Já se passaram 30 dias desde o seu último apoio. Ele foi muito importante para colocar nossas produções no ar. Se puder, apoie novamente e continue fazendo parte das próximas novelinhas.";
  } else if (event.event_type === "info_request" && !message) {
    title = "Precisamos das suas informações";
    message = "Seu apoio foi confirmado, mas ainda faltam informações ou imagens para continuarmos a produção do seu avatar. Entre na Área do Apoiador e conclua o Perfil de Divulgação.";
  }

  await admin.from("supporter_email_events").update({ status: "sending", attempts: Number(event.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq("id", event.id);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": event.idempotency_key },
    body: JSON.stringify({
      from: "O Surto Artificial <clube@osurtoartificial.com.br>",
      to: [event.recipient_email],
      reply_to: "osurtoartificial@gmail.com",
      subject: event.subject,
      html: emailFrame(title, message, button),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    await admin.from("supporter_email_events").update({ status: "failed", last_error: cleanText(body?.message || `Resend ${response.status}`, 800), updated_at: new Date().toISOString() }).eq("id", event.id);
    throw new Error("O e-mail não pôde ser enviado agora");
  }
  await admin.from("supporter_email_events").update({ status: "sent", provider_message_id: body.id || null, sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", event.id);
  return body.id;
}

async function dashboard() {
  const [users, profiles, supports, subscriptions, publicity, appearances, episodes, productions, emails, settings] = await Promise.all([
    listAuthUsers(),
    admin.from("profiles").select("id,role,status,display_name,created_at"),
    admin.from("supports").select("id,user_id,production_id,tier,billing_mode,amount,payment_status,paid_at,created_at,provider_payment_id,provider_checkout_id,productions(title,slug)").order("created_at", { ascending: false }),
    admin.from("subscriptions").select("id,user_id,tier,amount,status,next_due_date,started_at,created_at").order("created_at", { ascending: false }),
    admin.from("publicity_profiles").select("user_id,display_name,social_network,social_handle,social_url,notification_email,face_photo_path,body_photo_path,official_avatar_path,submission_completed_at,avatar_status,updated_at"),
    admin.from("appearances").select("id,support_id,episode_id,status,queue_priority,estimated_episode_number,estimated_date,confirmed_at,published_at,published_url,admin_notes,created_at,episodes(episode_number,scheduled_date,published_at,instagram_url,tiktok_url,youtube_url)").order("queue_priority", { ascending: false }).order("created_at"),
    admin.from("episodes").select("id,production_id,episode_number,scheduled_date,published_at,instagram_url,tiktok_url,youtube_url,is_locked,productions(title,slug)").order("episode_number", { ascending: false }),
    admin.from("productions").select("id,slug,title,status,current_episode,is_current").order("created_at", { ascending: false }),
    admin.from("supporter_email_events").select("id,user_id,support_id,event_type,recipient_email,subject,status,attempts,last_error,sent_at,created_at").order("created_at", { ascending: false }).limit(100),
    admin.from("app_settings").select("key,value,updated_at").eq("key", "renewal_reminders").maybeSingle(),
  ]);
  const results = [profiles, supports, subscriptions, publicity, appearances, episodes, productions, emails, settings];
  const failed = results.find((r: any) => r.error);
  if (failed?.error) throw failed.error;
  return {
    users,
    profiles: profiles.data || [], supports: supports.data || [], subscriptions: subscriptions.data || [],
    publicity: publicity.data || [], appearances: appearances.data || [], episodes: episodes.data || [],
    productions: productions.data || [], emails: emails.data || [], reminders: settings.data?.value || { enabled: true, days: 30 },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Método não permitido" }, 405);
  const user = await requireAdmin(req);
  if (!user) return json(req, { error: "Acesso exclusivo da produção" }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action || "dashboard", 40);

    if (action === "dashboard") return json(req, { ok: true, ...(await dashboard()) });

    if (action === "supporter_detail") {
      const userId = cleanText(body.user_id, 80);
      const [{ data: authUser }, { data: profile }, { data: supports }, { data: publicity }, { data: appearances }] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
        admin.from("supports").select("*,productions(title,slug)").eq("user_id", userId).order("created_at", { ascending: false }),
        admin.from("publicity_profiles").select("*").eq("user_id", userId).maybeSingle(),
        admin.from("appearances").select("*,episodes(*)").in("support_id", (await admin.from("supports").select("id").eq("user_id", userId)).data?.map((x: any) => x.id) || ["00000000-0000-0000-0000-000000000000"]),
      ]);
      const signed: Record<string, string | null> = { face: null, body: null };
      for (const [key, path] of [["face", publicity?.face_photo_path], ["body", publicity?.body_photo_path]] as const) {
        if (path) {
          const { data } = await admin.storage.from("supporter-photos").createSignedUrl(path, 600, { download: true });
          signed[key] = data?.signedUrl || null;
        }
      }
      return json(req, { ok: true, user: { id: userId, email: authUser.user?.email }, profile, supports: supports || [], publicity, appearances: appearances || [], signed });
    }

    if (action === "register_avatar") {
      const userId = cleanText(body.user_id, 80);
      const path = cleanText(body.path, 600);
      if (!userId || !path.startsWith(`${userId}/`)) return json(req, { error: "Arquivo de avatar inválido" }, 400);
      const now = new Date().toISOString();
      const { error } = await admin.from("publicity_profiles").update({ official_avatar_path: path, avatar_status: "ready", updated_at: now }).eq("user_id", userId);
      if (error) throw error;
      const { data: supportRows } = await admin.from("supports").select("id").eq("user_id", userId).eq("payment_status", "paid");
      const ids = (supportRows || []).map((x: any) => x.id);
      if (ids.length) await admin.from("appearances").update({ status: "queued", updated_at: now }).in("support_id", ids).in("status", ["waiting_profile", "waiting_avatar"]);
      return json(req, { ok: true });
    }

    if (action === "save_appearance") {
      const supportId = cleanText(body.support_id, 80);
      const { data: support } = await admin.from("supports").select("id,production_id,user_id").eq("id", supportId).maybeSingle();
      if (!support) return json(req, { error: "Apoio não encontrado" }, 404);
      let episodeId: string | null = null;
      const episodeNumber = Number(body.episode_number || 0);
      if (episodeNumber > 0 && support.production_id) {
        const episodePayload: any = { production_id: support.production_id, episode_number: episodeNumber, scheduled_date: body.estimated_date || null, updated_at: new Date().toISOString() };
        const { data: episode, error } = await admin.from("episodes").upsert(episodePayload, { onConflict: "production_id,episode_number" }).select().single();
        if (error) throw error;
        episodeId = episode.id;
      }
      const status = ["waiting_profile","waiting_avatar","queued","estimated","confirmed","in_production","published","reprogrammed","cancelled"].includes(body.status) ? body.status : "queued";
      const now = new Date().toISOString();
      const payload: any = {
        support_id: supportId, episode_id: episodeId, status,
        estimated_episode_number: episodeNumber > 0 ? episodeNumber : null,
        estimated_date: body.estimated_date || null,
        published_url: cleanText(body.published_url, 1000) || null,
        admin_notes: cleanText(body.admin_notes, 4000) || null,
        updated_at: now,
        confirmed_at: ["confirmed","in_production","published"].includes(status) ? now : null,
        published_at: status === "published" ? now : null,
      };
      const { data: existing } = await admin.from("appearances").select("id").eq("support_id", supportId).maybeSingle();
      const result = existing
        ? await admin.from("appearances").update(payload).eq("id", existing.id).select().single()
        : await admin.from("appearances").insert(payload).select().single();
      if (result.error) throw result.error;
      if (episodeId && status === "published") await admin.from("episodes").update({ published_at: now }).eq("id", episodeId);
      await admin.from("notifications").insert({ user_id: support.user_id, type: status === "published" ? "appearance" : "info", title: status === "published" ? "Seu episódio foi publicado!" : "Sua aparição foi atualizada", body: episodeNumber ? `Episódio ${episodeNumber}` : "A produção atualizou sua jornada.", action_url: status === "published" ? (payload.published_url || null) : null });
      return json(req, { ok: true, appearance: result.data });
    }

    if (action === "set_reminders") {
      const enabled = Boolean(body.enabled);
      const days = Math.max(1, Math.min(365, Number(body.days || 30)));
      const { error } = await admin.from("app_settings").upsert({ key: "renewal_reminders", value: { enabled, days }, updated_at: new Date().toISOString(), updated_by: user.id });
      if (error) throw error;
      return json(req, { ok: true, reminders: { enabled, days } });
    }

    if (action === "send_email") {
      const userId = cleanText(body.user_id, 80);
      const type = ["thank_you", "info_request", "renewal_reminder", "custom"].includes(body.event_type) ? body.event_type : "custom";
      const [{ data: authUser }, { data: publicity }, { data: support }] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin.from("publicity_profiles").select("notification_email").eq("user_id", userId).maybeSingle(),
        body.support_id ? admin.from("supports").select("id").eq("id", body.support_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const recipient = publicity?.notification_email || authUser.user?.email;
      if (!recipient) return json(req, { error: "Apoiador sem e-mail cadastrado" }, 400);
      const subjects: Record<string, string> = {
        thank_you: "Seu apoio chegou ao Clube do Surto 💙",
        info_request: "Precisamos das suas informações para continuar",
        renewal_reminder: "Há 30 dias você ajudou o Surto a continuar",
        custom: cleanText(body.subject, 180) || "Mensagem da produção do Surto",
      };
      const key = `manual:${type}:${crypto.randomUUID()}`;
      const { data: event, error } = await admin.from("supporter_email_events").insert({
        user_id: userId, support_id: support?.id || null, event_type: type,
        recipient_email: recipient, subject: subjects[type], message: cleanText(body.message, 8000) || null,
        idempotency_key: key, metadata: { sent_by: user.id },
      }).select().single();
      if (error) throw error;
      const messageId = await sendQueuedEmail(event);
      return json(req, { ok: true, message_id: messageId });
    }

    return json(req, { error: "Ação desconhecida" }, 400);
  } catch (error) {
    console.error("admin-production", error);
    return json(req, { error: error instanceof Error ? error.message : "Não foi possível concluir a ação" }, 500);
  }
});
