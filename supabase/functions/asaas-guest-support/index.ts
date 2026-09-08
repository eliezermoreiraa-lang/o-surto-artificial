import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isProductionWebhookReady } from "../asaas-create-support-payment/production-readiness.mjs";

const SB_URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('ASAAS_PRODUCTION_API_KEY')||'';
const HOOK_TOKEN=Deno.env.get('ASAAS_PRODUCTION_WEBHOOK_TOKEN')||'';
const admin=createClient(SB_URL,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const origins=new Set(['https://osurtoartificial.com.br','https://www.osurtoartificial.com.br','https://o-surto-artificial.vercel.app']);
const PUBLIC_KEY='sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C';
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
async function asaas(path:string,method='GET',body?:unknown){
 const response=await fetch('https://api.asaas.com/v3'+path,{method,headers:{access_token:KEY,'content-type':'application/json','user-agent':'O-Surto-Artificial/Guest'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok)throw Error('provider_'+response.status);return data;
}
function validCpf(value:string){
 if(!/^\d{11}$/.test(value)||/^(\d)\1{10}$/.test(value))return false;
 for(let n=9;n<11;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(value[i])*(n+1-i);const d=(sum*10)%11;if(Number(value[n])!==(d===10?0:d))return false}return true;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://osurtoartificial.com.br','Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return reply({ok:true});
 if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 // Intentionally public, free-tier only. This does not grant any member access.
 if(!origins.has(origin)||req.headers.get('apikey')!==PUBLIC_KEY)return reply({error:'Requisição inválida'},403);
 if(!KEY||!HOOK_TOKEN)return reply({error:'Pagamento temporariamente indisponível'},503);
 let row:any=null;
 try{
  const raw=await req.text();if(raw.length>4096)return reply({error:'Dados inválidos'},400);
  let body:any;try{body=JSON.parse(raw)}catch(_){return reply({error:'Dados inválidos'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Dados inválidos'},400);
  if(!/^[a-f0-9]{64}$/.test(body.requestToken||''))return reply({error:'Identificador inválido'},400);
  const tokenHash=await hash(body.requestToken);
  const resultFor=async(checkout:any)=>{
   if(Date.now()-new Date(checkout.created_at).getTime()>7*86400000)return reply({error:'Este acompanhamento expirou.'},410);
   const {data:support}=await admin.from('supports').select('payment_status').eq('id',checkout.support_id).is('user_id',null).eq('tier','free').maybeSingle();
   return reply({ok:true,...(checkout.result||{}),state:checkout.state,paymentStatus:support?.payment_status||'pending'});
  };
  if(body.action==='status'){
   const {data,error}=await admin.from('guest_support_checkouts').select('*').eq('token_hash',tokenHash).maybeSingle();
   if(error)throw Error('database_status');if(!data)return reply({error:'Apoio não encontrado'},404);return await resultFor(data);
  }
  if(body.action!=='create'||body.tier!=='free'||body.userId||body.upgradeFromSupportId)return reply({error:'Somente o Apoio Livre pode ser feito sem conta.'},400);
  const amount=Number(body.amount),fullName=String(body.fullName||'').trim(),cpf=String(body.cpfCnpj||'').replace(/\D/g,''),email=String(body.email||'').trim();
  if(!Number.isFinite(amount)||amount<1||amount>10000||Math.abs(amount*100-Math.round(amount*100))>0.000001)return reply({error:'Informe um valor entre R$ 1,00 e R$ 10.000,00, com até duas casas decimais.'},400);
  if(fullName.length<3||fullName.length>120||!validCpf(cpf))return reply({error:'Confira seu nome completo e CPF.'},400);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:'Confira o e-mail informado.'},400);
  if(!['pix','cartao'].includes(body.method))return reply({error:'Escolha Pix ou cartão.'},400);
  const fingerprint=await hash(JSON.stringify([amount,fullName,cpf,email,body.method]));
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';
  const {data:claim,error:claimError}=await admin.rpc('claim_guest_support_checkout',{p_token_hash:tokenHash,p_fingerprint:fingerprint,p_ip_hash:await hash(HOOK_TOKEN+ip)});
  if(claimError)throw Error('database_claim');
  if(claim.error)return reply({error:claim.error==='rate_limit'?'Muitas tentativas. Aguarde alguns minutos.':'Este pagamento já foi iniciado com outros dados.'},claim.error==='rate_limit'?429:409);
  if(claim.existing)return await resultFor(claim.checkout);row=claim.checkout;
  const hooks=await asaas('/webhooks?limit=100');
  if(!isProductionWebhookReady(hooks,SB_URL+'/functions/v1/asaas-webhook'))throw Error('webhook_unavailable');
  const {data:plan,error:planError}=await admin.from('support_plans').select('active,minimum_amount').eq('slug','free').maybeSingle();
  if(planError||!plan?.active||amount<Number(plan.minimum_amount))throw Error('plan_unavailable');
  const {error:insertError}=await admin.from('supports').insert({id:row.support_id,user_id:null,tier:'free',billing_mode:'one_time',amount,minimum_amount:Number(plan.minimum_amount),payment_status:'pending',payment_provider:'asaas',external_reference:row.support_id});
  if(insertError)throw Error('database_insert');
  // A separate processor customer is not a site login/account; never match an unverified e-mail to a member.
  const customer=await asaas('/customers','POST',{name:fullName,cpfCnpj:cpf,...(email?{email}:{}),externalReference:'guest:'+row.support_id,notificationDisabled:true});
  const dueDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+172800000));
  const payment=await asaas('/payments','POST',{customer:customer.id,billingType:body.method==='pix'?'PIX':'CREDIT_CARD',value:amount,dueDate,description:'O Surto Artificial — Apoio Livre (sem divulgação)',externalReference:row.support_id});
  const invoice=new URL(payment.invoiceUrl);if(invoice.protocol!=='https:'||!(invoice.hostname==='asaas.com'||invoice.hostname.endsWith('.asaas.com')))throw Error('invalid_invoice');
  const {error:updateError}=await admin.from('supports').update({provider_payment_id:payment.id,provider_checkout_id:payment.invoiceUrl}).eq('id',row.support_id);if(updateError)throw Error('database_payment');
  const result:any={amount,invoiceUrl:payment.invoiceUrl,method:body.method};
  if(body.method==='pix'){
   for(const delay of [0,500,1500]){if(delay)await new Promise(r=>setTimeout(r,delay));try{const qr=await asaas('/payments/'+payment.id+'/pixQrCode');result.pix={encodedImage:qr.encodedImage,payload:qr.payload};break}catch(_){}}
  }
  const {error:readyError}=await admin.from('guest_support_checkouts').update({state:'ready',result}).eq('token_hash',tokenHash);if(readyError)throw Error('database_ready');
  return reply({ok:true,...result,state:'ready',paymentStatus:'pending'});
 }catch(error){
  if(row)await admin.from('guest_support_checkouts').update({state:'failed'}).eq('token_hash',row.token_hash);
  // Never mark paid/failed after an uncertain provider response or retry charge creation automatically.
  console.error('guest_checkout_error',error instanceof Error?error.message:'unknown');
  return reply({error:'Não foi possível concluir a solicitação. Não tente pagar novamente se já realizou o pagamento; entre em contato com a equipe.'},502);
 }
});
