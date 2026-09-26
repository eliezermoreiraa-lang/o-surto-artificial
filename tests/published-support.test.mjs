import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {supportLifecycle} from '../supabase/functions/_shared/support-lifecycle.mjs';
import {supportPrice as price} from '../supabase/functions/_shared/promotion.mjs';
const supportPrice = t => price(t, '2026-09-26T12:00:00-03:00');
const support = (id, tier='supporter', extra={}) => ({id, user_id:'owner',tier,amount:25,payment_status:'paid',created_at:'2026-09-25',...extra});
const published = id => ({support_id:id,status:'published'});

async function run(name,{supports=[],appearances=[],appearanceError=false,body={}}={}) {
  let handler; const writes=[],charges=[];
  const from=table=>{
    let inserted=false;
    const data=()=>table==='supports'?supports:table==='appearances'?appearances:table==='subscriptions'||table==='vip_briefings'?[]:null;
    const chain=new Proxy({}, {get:(_,key)=>{
      if(key==='then')return resolve=>Promise.resolve({data:data(),error:table==='appearances'&&appearanceError?{message:'unavailable'}:null}).then(resolve);
      if(key==='insert'||key==='update')return row=>{writes.push({table,row});inserted=true;return chain};
      if(key==='single')return async()=>({data:inserted?{id:'new-support'}:null});
      if(key==='maybeSingle')return async()=>({data:table==='support_plans'?{active:true,name:'Apoio',minimum_amount:1}:table==='productions'?{id:'production'}:null});
      return ()=>chain;
    }});return chain;
  };
  const ctx=vm.createContext({Response,Request,AbortSignal,Intl,Date,Set,console,setTimeout,supportLifecycle,supportPrice,isProductionWebhookReady:()=>true,
    Deno:{env:{get:n=>n==='SUPABASE_URL'?'https://test.supabase.co':'mock-secret'},serve:fn=>handler=fn},
    createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'owner',email:'test@example.invalid'}}})},from}),
    fetch:async(url,opts)=>{
      if(url.includes('/webhooks?'))return Response.json({data:[]});
      if(url.includes('/customers?'))return Response.json({data:[]});
      if(url.endsWith('/customers'))return Response.json({id:'mock-customer'});
      if(url.endsWith('/payments')){charges.push(JSON.parse(opts.body));return Response.json({id:'mock-payment',invoiceUrl:'https://example.invalid/pay'})}
      if(url.endsWith('/pixQrCode'))return Response.json({payload:'mock',encodedImage:'mock'});
      throw Error('Unexpected request');
    }
  });
  const source=fs.readFileSync(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  vm.runInContext(stripTypeScriptTypes(source),ctx);
  const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{authorization:'Bearer mock','content-type':'application/json'},body:JSON.stringify({cpfCnpj:'12345678901',method:'pix',...body})}));
  return {status:response.status,data:await response.json(),writes,charges};
}

for(const tier of ['supporter','highlight','vip'])for(const method of ['pix','cartao']) {
  test(`published VIP can buy new ${tier} using ${method} at full current price`,async()=>{
    const result=await run('asaas-create-support-payment',{supports:[support('old','vip',{amount:150})],appearances:[published('old')],body:{tier,method,amount:supportPrice(tier)}});
    assert.equal(result.status,200);assert.equal(result.data.credit,0);assert.equal(result.charges[0].value,supportPrice(tier));
    assert.equal(result.writes[0].row.upgrade_from_support_id,null);
  });
}
test('published source refuses stale upgrade before writes or charge',async()=>{
  const r=await run('asaas-create-support-payment',{supports:[support('old')],appearances:[published('old')],body:{tier:'vip',upgradeFromSupportId:'old',expectedAmount:125}});
  assert.equal(r.status,409);assert.equal(r.data.code,'support_not_upgradeable');assert.equal(r.writes.length,0);assert.equal(r.charges.length,0);
});
test('new purchase cannot submit discounted difference',async()=>{
  const r=await run('asaas-create-support-payment',{supports:[support('old')],appearances:[published('old')],body:{tier:'highlight',amount:25}});
  assert.equal(r.status,409);assert.equal(r.data.code,'price_changed');assert.equal(r.writes.length,0);
});
test('unpublished support retains legitimate upgrade',async()=>{
  const r=await run('asaas-create-support-payment',{supports:[support('open')],appearances:[{support_id:'open',status:'queued'}],body:{tier:'highlight',upgradeFromSupportId:'open',expectedAmount:25}});
  assert.equal(r.status,200);assert.equal(r.charges[0].value,25);
});
test('appearance query errors fail closed',async()=>{
  for(const name of ['asaas-create-support-payment','supporter-dashboard-data']) {
    const r=await run(name,{supports:[support('old')],appearanceError:true,body:{tier:'vip',amount:150}});
    assert.equal(r.status,503);assert.equal(r.writes.length,0);
  }
});
test('publication consumes all ancestors and descendants, but not independent renewal',()=>{
  const rows=[support('a'),support('b','highlight',{upgrade_from_support_id:'a'}),support('c','vip',{upgrade_from_support_id:'b'}),support('renewal')];
  for(const id of ['a','b','c'])assert.deepEqual(supportLifecycle(rows,[published(id)]).available.map(s=>s.id),['renewal']);
  assert.deepEqual(supportLifecycle(rows,[]).available.map(s=>s.id),['c','renewal']);
});
test('dashboard preserves history/VIP but removes consumed credit',async()=>{
  const r=await run('supporter-dashboard-data',{supports:[support('old','vip',{amount:150})],appearances:[published('old')]});
  assert.equal(r.status,200);assert.equal(r.data.currentSupport.id,'old');assert.equal(r.data.vipAccess,true);
  assert.equal(r.data.currentCredit,0);assert.equal(r.data.upgradeSupport,null);assert.equal(r.data.canPurchaseAgain,true);
  assert.ok(r.data.upgrades.every(u=>!u.available&&u.amountDue===supportPrice(u.tier)));
});
test('old VIP does not override eligibility of new supporter',async()=>{
  const r=await run('supporter-dashboard-data',{supports:[support('old','vip'),support('new')],appearances:[published('old')]});
  assert.equal(r.data.upgradeSupport.id,'new');assert.equal(r.data.canPurchaseAgain,false);
  assert.deepEqual(r.data.upgrades.filter(u=>u.available).map(u=>u.tier),['highlight','vip']);
});
test('published home and stale upgrade/VIP routes show exactly three fresh purchases',()=>{
  const code=fs.readFileSync(new URL('../supporter-dashboard-real-v2.js',import.meta.url),'utf8');
  const window={SurtoClub:{plans:['free','supporter','highlight','vip'].map(t=>({tier:t,label:t,benefits:[],amount:t==='free'?10:supportPrice(t)})),priceHtml:p=>String(p.amount)}};
  vm.runInNewContext(code.slice(0,code.indexOf('  async function render('))+'window.views={homeHtml,joinHtml,upgradeHtml,vipHtml};})();',{window});
  const m={currentSupport:support('old','vip'),canPurchaseAgain:true,upgradeSupport:null,user:{},upgrades:[]};
  for(const render of Object.values(window.views)) {
    const html=render(m);
    assert.equal((html.match(/data-join-tier=/g)||[]).length,3);
    assert.doesNotMatch(html,/data-join-tier="free"|data-upgrade-tier|VER OPÇÕES DE UPGRADE/);
  }
});
