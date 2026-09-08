import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {monthlyEvents,consentVersion,prices,checkoutLink,monthlyCheckout,resolveMonthlyEvent} from '../supabase/functions/asaas-monthly-support/shared.mjs';
import {isProductionWebhookReady,requiredPaymentEvents} from '../supabase/functions/asaas-create-support-payment/production-readiness.mjs';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const valid={action:'create',tier:'supporter',method:'cartao',consent:true,consentVersion};
function harness({user='owner',row=null,providerError=null,missingEvents=false}={}){
  let handler;const calls=[],records=row?[structuredClone(row)]:[];
  let hook={id:'hook',url:'https://project.supabase.co/functions/v1/asaas-webhook',enabled:true,interrupted:false,apiVersion:3,sendType:'SEQUENTIALLY',events:[...requiredPaymentEvents,...(missingEvents?[]:monthlyEvents)]};
  function from(table){let filters=[],op='select',values;
    const result=()=>{
      if(table==='support_plans')return {data:{active:true,minimum_amount:50}};
      let matches=records.filter(r=>filters.every(f=>f(r)));
      if(op==='insert'){if(records.some(r=>['pending','active','past_due'].includes(r.status)))return {error:{code:'23505'}};const c={id,...values};records.push(c);return {data:c}}
      if(op==='update')matches.forEach(r=>Object.assign(r,values));
      return {data:matches[0]||null,error:null};
    };
    const chain=new Proxy({}, {get(_,key){if(key==='then')return resolve=>Promise.resolve(result()).then(resolve);if(['single','maybeSingle'].includes(key))return async()=>result();if(key==='eq')return(k,v)=>{filters.push(r=>r[k]===v);return chain};if(key==='in')return(k,v)=>{filters.push(r=>v.includes(r[k]));return chain};if(key==='is')return(k,v)=>{filters.push(r=>(r[k]??null)===v);return chain};if(['insert','update'].includes(key))return v=>{op=key;values=v;return chain};return()=>chain}});return chain;
  }
  const provider=async(path,opts={})=>{
    calls.push({path,...opts});
    if(path==='/webhooks?limit=100')return {data:[hook]};
    if(path==='/webhooks/hook'){hook={...hook,...JSON.parse(opts.body)};return hook}
    if(providerError)throw Object.assign(new Error('mock failure'),providerError);
    if(path==='/checkouts')return {id:'checkout-123456',status:'ACTIVE'};
    if(opts.method==='DELETE'||path.endsWith('/cancel'))return {deleted:true};
    throw Error('Unexpected request '+path);
  };
  const source=fs.readFileSync(new URL('../supabase/functions/asaas-monthly-support/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInNewContext(stripTypeScriptTypes(source),{Response,Request,Set,Date,Intl,console,monthlyEvents,consentVersion,prices,checkoutLink,monthlyCheckout,provider,isProductionWebhookReady,
    Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://project.supabase.co':'test-secret'},serve:fn=>handler=fn},
    createClient:()=>({auth:{getUser:async()=>({data:{user:user?{id:user}:null}})},from})});
  return {calls,records,send:async(body=valid,authorization='Bearer test')=>{const r=await handler(new Request('https://project.supabase.co/functions/v1/asaas-monthly-support',{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}}};
}
test('monthly checkout is hosted, fixed price, recurring only, no card fields',async()=>{const h=harness();const out=await h.send({...valid,amount:1});assert.equal(out.status,200);const p=JSON.parse(h.calls.find(c=>c.path==='/checkouts').body);assert.deepEqual(p.billingTypes,['CREDIT_CARD']);assert.deepEqual(p.chargeTypes,['RECURRENT']);assert.equal(p.subscription.cycle,'MONTHLY');assert.equal(p.items[0].value,50);assert.equal(p.externalReference,'monthly:'+id);assert.equal(p.creditCard,undefined);assert.equal(h.records[0].consent_version,consentVersion)});
for(const [name,body] of Object.entries({noConsent:{consent:false},wrongTerms:{consentVersion:'old'},pix:{method:'pix'},free:{tier:'free'},prototype:{tier:'toString'},upgrade:{upgradeFromSupportId:id}}))test('rejects '+name+' before creating checkout',async()=>{const h=harness();assert.equal((await h.send({...valid,...body})).status,400);assert.equal(h.calls.length,0);assert.equal(h.records.length,0)});
test('requires real authenticated user',async()=>{const h=harness({user:null});assert.equal((await h.send()).status,401);assert.equal(h.calls.length,0)});
test('duplicate click resumes one existing checkout',async()=>{const h=harness();await h.send();const out=await h.send();assert.equal(out.status,200);assert.equal(out.data.resumed,true);assert.equal(h.records.length,1);assert.equal(h.calls.filter(c=>c.path==='/checkouts').length,1)});
test('ambiguous timeout never creates second contract or charge',async()=>{const h=harness({providerError:{}});assert.equal((await h.send()).status,502);assert.equal((await h.send()).status,409);assert.equal(h.calls.filter(c=>c.path==='/checkouts').length,1)});
test('adds monthly events without removing existing events',async()=>{const h=harness({missingEvents:true});assert.equal((await h.send()).status,200);const events=JSON.parse(h.calls.find(x=>x.path==='/webhooks/hook').body).events;for(const e of [...requiredPaymentEvents,...monthlyEvents])assert.ok(events.includes(e))});
test('cannot cancel another account contract',async()=>{const h=harness({row:{id,user_id:'someone-else',status:'active',provider_subscription_id:'sub_1'}});assert.equal((await h.send({action:'cancel',subscriptionId:id})).status,404);assert.equal(h.calls.length,0)});
test('cancel stops provider before updating local contract, idempotently',async()=>{const h=harness({row:{id,user_id:'owner',status:'active',provider_subscription_id:'sub_1'}});assert.equal((await h.send({action:'cancel',subscriptionId:id})).status,200);assert.equal(h.calls[0].method,'DELETE');assert.equal(h.records[0].status,'cancelled');await h.send({action:'cancel',subscriptionId:id});assert.equal(h.calls.length,1)});
test('failed cancellation retains active contract',async()=>{const h=harness({row:{id,user_id:'owner',status:'active',provider_subscription_id:'sub_1'},providerError:{status:500}});assert.equal((await h.send({action:'cancel',subscriptionId:id})).status,502);assert.equal(h.records[0].status,'active')});
test('webhook maps checkout to subscription, reads canonical state and nearest bill',async()=>{
  const contract={id,checkout_id:'checkout-123456'};const requests=[];
  const admin={from:()=>({select(){return this},eq(k,v){this.found=contract[k]===v;return this},async maybeSingle(){return {data:this.found?contract:null}}})};
  const result=await resolveMonthlyEvent(admin,{event:'PAYMENT_CREATED',payment:{id:'pay1',subscription:'sub1'}},async path=>{
    requests.push(path);if(path==='/payments/pay1')return {id:'pay1',subscription:'sub1',checkoutSession:'checkout-123456',status:'CONFIRMED',value:50};
    if(path==='/subscriptions/sub1')return {id:'sub1',value:50,nextDueDate:'2026-12-08'};
    if(path.includes('/payments?'))return {data:[{dueDate:'2026-10-08',status:'PENDING'}]};throw Error(path);
  });
  assert.equal(result.contract.id,id);assert.equal(result.remote.nextDueDate,'2026-10-08');assert.equal(result.payment.status,'CONFIRMED');assert.equal(requests.length,3);
});
test('one-time webhook does not contact provider or change recurring records',async()=>assert.equal(await resolveMonthlyEvent({}, {event:'PAYMENT_RECEIVED',payment:{id:'one_time'}},()=>{throw Error('unexpected')}),null));
