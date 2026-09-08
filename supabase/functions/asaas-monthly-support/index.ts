import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.95.3";
import { monthlyEvents, consentVersion, prices, checkoutLink, monthlyCheckout, provider } from "./shared.mjs";
import { isProductionWebhookReady } from "../asaas-create-support-payment/production-readiness.mjs";

const base=Deno.env.get('SUPABASE_URL')!;
const origins=new Set(['https://osurtoartificial.com.br','https://www.osurtoartificial.com.br','https://o-surto-artificial.vercel.app']);
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://osurtoartificial.com.br','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==='OPTIONS')return json({ok:true});
  if(req.method!=='POST')return json({error:'Método não permitido'},405);
  if(origin&&!origins.has(origin))return json({error:'Origem não permitida'},403);
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return json({error:'Entre na sua conta para gerenciar a assinatura.'},401);
  const admin=createClient(base,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:auth,error:authError}=await admin.auth.getUser(token);
  if(authError||!auth?.user)return json({error:'Sua sessão expirou. Entre novamente.'},401);
  const user=auth.user;
  const body=await req.json().catch(()=>({}));
  try{
    if(body.action==='cancel'){
      if(!/^[0-9a-f-]{36}$/i.test(body.subscriptionId||''))return json({error:'Assinatura inválida'},400);
      const {data:c,error}=await admin.from('subscriptions').select('*').eq('id',body.subscriptionId).eq('user_id',user.id).maybeSingle();
      if(error)throw error;
      if(!c)return json({error:'Assinatura não encontrada'},404);
      if(['cancelled','expired'].includes(c.status))return json({ok:true,cancelled:true});
      if(c.provider_subscription_id){
        try{await provider(`/subscriptions/${encodeURIComponent(c.provider_subscription_id)}`,{method:'DELETE'})}
        catch(err:any){if(err.status!==404)throw err}
      }else if(c.checkout_id){
        // If checkout was just paid, Asaas refuses cancellation: wait for its subscription webhook.
        await provider(`/checkouts/${encodeURIComponent(c.checkout_id)}/cancel`,{method:'POST'});
      }else return json({error:'A contratação está sendo sincronizada. Aguarde um instante antes de cancelar.'},409);
      const {error:saveError}=await admin.from('subscriptions').update({status:'cancelled',cancelled_at:new Date().toISOString(),next_due_date:null,checkout_state:'CANCELED'}).eq('id',c.id).eq('user_id',user.id);
      if(saveError)throw saveError;
      return json({ok:true,cancelled:true});
    }
    if(body.action!=='create')return json({error:'Ação inválida'},400);
    if(!Object.hasOwn(prices,body.tier))return json({error:'Escolha Apoiador, Destaque ou VIP. Apoio Livre permanece avulso.'},400);
    if(body.consent!==true||body.consentVersion!==consentVersion||body.method!=='cartao')return json({error:'Autorize a cobrança mensal no cartão para continuar.'},400);
    if(body.upgradeFromSupportId)return json({error:'A assinatura mensal não utiliza o crédito de um upgrade avulso.'},400);
    if(!Deno.env.get('ASAAS_PRODUCTION_API_KEY')||!Deno.env.get('ASAAS_PRODUCTION_WEBHOOK_TOKEN'))return json({error:'Assinaturas temporariamente indisponíveis'},503);
    const hooks=await provider('/webhooks?limit=100');
    const webhookUrl=`${base}/functions/v1/asaas-webhook`;
    if(!isProductionWebhookReady(hooks,webhookUrl))return json({error:'A confirmação de pagamentos está indisponível. Tente novamente mais tarde.'},503);
    const hook=hooks.data.find((h:any)=>h.url===webhookUrl&&h.enabled&&!h.interrupted);
    // Preserve existing configuration; add only events required by this newly enabled feature.
    if(!monthlyEvents.every(event=>hook.events.includes(event))){
      await provider(`/webhooks/${encodeURIComponent(hook.id)}`,{method:'PUT',body:JSON.stringify({events:[...new Set([...hook.events,...monthlyEvents])]})});
      const verified=await provider('/webhooks?limit=100');
      if(!verified.data?.some((h:any)=>h.id===hook.id&&monthlyEvents.every(event=>h.events.includes(event))))return json({error:'Não foi possível habilitar a confirmação das assinaturas.'},503);
    }
    const {data:plan,error:planError}=await admin.from('support_plans').select('active,minimum_amount').eq('slug',body.tier).maybeSingle();
    if(planError)throw planError;
    if(!plan?.active||Number(plan.minimum_amount)!==prices[body.tier])return json({error:'Plano indisponível'},400);
    const existing=async()=>{const {data,error}=await admin.from('subscriptions').select('*').eq('user_id',user.id).in('status',['pending','active','past_due']).maybeSingle();if(error)throw error;return data};
    const resume=(c:any)=> c.status==='pending'&&c.checkout_id&&c.tier===body.tier&&c.checkout_state==='ACTIVE'
      ?json({ok:true,subscriptionId:c.id,invoiceUrl:checkoutLink(c.checkout_id),amount:c.amount,resumed:true})
      :json({error:c.status==='pending'?'Sua contratação está em andamento. Confira Minha Assinatura antes de tentar novamente.':'Você já possui uma assinatura. Gerencie ou cancele a atual em Minha Assinatura antes de contratar outra.',code:'subscription_exists'},409);
    const current=await existing();if(current)return resume(current);
    const {data:c,error:insertError}=await admin.from('subscriptions').insert({user_id:user.id,tier:body.tier,amount:prices[body.tier],status:'pending',payment_provider:'asaas',consent_at:new Date().toISOString(),consent_version:consentVersion}).select('*').single();
    if(insertError){if(insertError.code==='23505'){const previous=await existing();if(previous)return resume(previous)}throw insertError}
    let submitted=false;
    try{
      // Asaas collects personal/card fields on its hosted page. No PAN/CVV reaches this server.
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const payload=monthlyCheckout(c,undefined,date);
      submitted=true;
      const checkout=await provider('/checkouts',{method:'POST',body:JSON.stringify(payload)});
      const link=checkoutLink(checkout.id);
      const {error}=await admin.from('subscriptions').update({checkout_id:checkout.id,checkout_url:link,checkout_state:checkout.status||'ACTIVE'}).eq('id',c.id);
      if(error)throw error;
      return json({ok:true,subscriptionId:c.id,invoiceUrl:link,amount:c.amount});
    }catch(error:any){
      // A timeout is ambiguous: keep the contract locked. CHECKOUT_CREATED can recover its ID.
      if(!submitted||(error.status>=400&&error.status<500))await admin.from('subscriptions').update({status:'expired',checkout_state:'FAILED'}).eq('id',c.id).is('checkout_id',null);
      console.error('monthly_checkout_failed',{contractId:c.id,status:error.status||null});
      return json({error:'Não foi possível abrir a assinatura. Consulte Minha Assinatura antes de tentar novamente.'},502);
    }
  }catch(error:any){console.error('monthly_support_failed',{action:body.action,status:error.status||null});return json({error:'Não foi possível concluir a operação. Seus apoios pagos foram preservados.'},502)}
});
