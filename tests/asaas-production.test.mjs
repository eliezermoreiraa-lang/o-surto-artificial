import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {isProductionWebhookReady,requiredPaymentEvents} from '../supabase/functions/asaas-create-support-payment/production-readiness.mjs';
const url='https://project.supabase.co/functions/v1/asaas-webhook';
const hook={url,enabled:true,interrupted:false,apiVersion:3,sendType:'SEQUENTIALLY',events:requiredPaymentEvents};
test('ready only with all confirmation settings',()=>assert.equal(isProductionWebhookReady({data:[hook]},url),true));
for(const [name,changes] of Object.entries({disabled:{enabled:false},interrupted:{interrupted:true},wrongUrl:{url:'https://other.example'},wrongVersion:{apiVersion:2},unordered:{sendType:'NON_SEQUENTIALLY'},missingEvent:{events:['PAYMENT_RECEIVED']}})){
 test(`refuses ${name}`,()=>assert.equal(isProductionWebhookReady({data:[{...hook,...changes}]},url),false));
}
test('fails closed on missing provider data',()=>{for(const data of [null,{}, {data:[]},{data:null}])assert.equal(isProductionWebhookReady(data,url),false)});
test('production secrets only, no sandbox fallback or dummy CPF',()=>{
 const payment=fs.readFileSync(new URL('../supabase/functions/asaas-create-support-payment/index.ts',import.meta.url),'utf8');
 const webhook=fs.readFileSync(new URL('../supabase/functions/asaas-webhook/index.ts',import.meta.url),'utf8');
 assert.match(payment,/https:\/\/api\.asaas\.com\/v3/);
 assert.match(payment,/ASAAS_PRODUCTION_API_KEY/);
 assert.match(webhook,/ASAAS_PRODUCTION_WEBHOOK_TOKEN/);
 assert.doesNotMatch(payment,/api-sandbox|24971563792|Deno\.env\.get\("ASAAS_API_KEY"\)/);
 assert.doesNotMatch(webhook,/Deno\.env\.get\("ASAAS_WEBHOOK_TOKEN"\)/);
 assert.ok(payment.indexOf('isProductionWebhookReady(webhooks')<payment.indexOf('.insert({'));
});
test('actual payment handler refuses disabled webhook before any writes',async()=>{
 let handler,fetches=0;
 const source=fs.readFileSync(new URL('../supabase/functions/asaas-create-support-payment/index.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const context=vm.createContext({Response,Request,AbortSignal,Intl,Date,Set,console,setTimeout,isProductionWebhookReady,
  Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://project.supabase.co':'private-test-value'},serve:fn=>{handler=fn}},
  createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'test'}}})},from:()=>{throw Error('Unexpected database access')}}),
  fetch:async(url,options)=>{fetches++;assert.equal(options.method,'GET');assert.equal(url,'https://api.asaas.com/v3/webhooks?limit=100');return Response.json({data:[{...hook,enabled:false}]})},
 });
 vm.runInContext(stripTypeScriptTypes(source),context);
 const response=await handler(new Request('https://project.supabase.co/functions/v1/asaas-create-support-payment',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({tier:'supporter',method:'pix',amount:50,cpfCnpj:'12345678901'})}));
 assert.equal(response.status,503);assert.equal((await response.json()).code,'payment_confirmation_unavailable');assert.equal(fetches,1);
});
