import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../supabase/functions/asaas-guest-support/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const token='a'.repeat(64),body={requestToken:token,action:'create',tier:'free',method:'pix',amount:10.25,fullName:'Teste Sem Conta',cpfCnpj:'52998224725'};
function setup(){
 let handler,paid=false,limited=false;const rows=new Map(),supports=new Map(),calls=[];
 const from=table=>{
  let field,value,op,row;const chain=new Proxy({}, {get:(_,key)=>{
   if(key==='select')return ()=>chain;
   if(key==='eq')return (f,v)=>{if(f==='id'||f==='token_hash'){field=f;value=v}return chain};
   if(key==='is')return ()=>chain;
   if(key==='insert'||key==='update')return data=>{op=key;row=data;return chain};
   const run=()=>{
    const store=table==='guest_support_checkouts'?rows:supports;
    if(op==='insert'){assert.equal(table,'supports');assert.equal(row.user_id,null);assert.equal(row.tier,'free');store.set(row.id,{...row});return {error:null}}
    if(op==='update'){Object.assign(store.get(value)||{},row);return {error:null}}
    if(table==='support_plans')return {data:{active:true,minimum_amount:1}};
    if(table==='supports')return {data:supports.has(value)?{payment_status:paid?'paid':'pending'}:null};
    return {data:store.get(value)||null};
   };
   if(key==='maybeSingle')return async()=>run();
   if(key==='then')return resolve=>Promise.resolve(run()).then(resolve);
   throw Error('Unexpected query '+key);
  }});return chain;
 };
 const admin={from,rpc:async(name,p)=>{
  assert.equal(name,'claim_guest_support_checkout');
  if(limited)return {data:{error:'rate_limit'}};
  const existing=rows.get(p.p_token_hash);
  if(existing)return {data:existing.fingerprint===p.p_fingerprint?{existing:true,checkout:existing}:{error:'conflict'}};
  const checkout={token_hash:p.p_token_hash,fingerprint:p.p_fingerprint,support_id:'support-'+rows.size,state:'processing',created_at:new Date().toISOString()};
  rows.set(p.p_token_hash,checkout);return {data:{existing:false,checkout}};
 }};
 vm.runInNewContext(stripTypeScriptTypes(source),{Response,Request,URL,Intl,Date,Set,TextEncoder,Uint8Array,crypto:webcrypto,AbortSignal,setTimeout,console,
  Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://project.supabase.co':'test-secret'},serve:fn=>handler=fn},createClient:()=>admin,isProductionWebhookReady:()=>true,
  fetch:async(url,options)=>{calls.push({url,...options});if(url.includes('/webhooks'))return Response.json({});if(url.endsWith('/customers'))return Response.json({id:'customer'});if(url.endsWith('/payments'))return Response.json({id:'payment',invoiceUrl:'https://www.asaas.com/i/test'});if(url.endsWith('/pixQrCode'))return Response.json({encodedImage:'test',payload:'test'});throw Error('Unexpected external request')}
 });
 const request=(data=body,headers={})=>handler(new Request('https://project.supabase.co/functions/v1/asaas-guest-support',{method:'POST',headers:{origin:'https://osurtoartificial.com.br',apikey:'sb_publishable_RQVP_F6Ix1ZxHhu9HzO9bA_yy9wfb8C','content-type':'application/json',...headers},body:JSON.stringify(data)}));
 return {request,calls,supports,rows,setPaid:()=>paid=true,setLimited:()=>limited=true};
}
for(const method of ['pix','cartao'])test('guest '+method+' preserves cents without auth/account and reuses same charge',async()=>{
 const s=setup(),data={...body,method,amount:1000.25};
 const first=await s.request(data);assert.equal(first.status,200);assert.equal((await first.json()).amount,1000.25);
 const again=await s.request(data);assert.equal(again.status,200);
 const payments=s.calls.filter(c=>c.url.endsWith('/payments'));assert.equal(payments.length,1);assert.equal(JSON.parse(payments[0].body).value,1000.25);
 assert.equal([...s.supports.values()][0].user_id,null);
 s.setPaid();const status=await s.request({action:'status',requestToken:token});assert.equal((await status.json()).paymentStatus,'paid');
});
for(const changes of [{tier:'vip'},{tier:'highlight'},{tier:'supporter'},{userId:'victim'},{upgradeFromSupportId:'other'},{amount:0},{amount:10.255},{amount:10001},{cpfCnpj:'11111111111'},{requestToken:'short'},{method:'boleto'}])test('reject invalid guest input '+JSON.stringify(changes),async()=>{const s=setup();assert.equal((await s.request({...body,...changes})).status,400);assert.equal(s.calls.length,0);assert.equal(s.rows.size,0)});
test('rate limit, origin/key checks, unknown capability and fingerprint conflict',async()=>{
 const s=setup();assert.equal((await s.request(body,{origin:'https://evil.example'})).status,403);
 assert.equal((await s.request(body,{apikey:'invalid'})).status,403);
 assert.equal((await s.request({action:'status',requestToken:'b'.repeat(64)})).status,404);
 await s.request();assert.equal((await s.request({...body,amount:50})).status,409);
 s.setLimited();assert.equal((await s.request({...body,requestToken:'c'.repeat(64)})).status,429);
 assert.equal(s.calls.filter(c=>c.url.endsWith('/payments')).length,1);
});
