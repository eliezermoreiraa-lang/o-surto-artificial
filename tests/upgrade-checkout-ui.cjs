// Isolated UI fixtures: all network requests are intercepted; no real account or charge.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const tabs=['INÍCIO','MEUS APOIOS','MINHAS APARIÇÕES','PERFIL DE DIVULGAÇÃO','MINHA ASSINATURA','MEUS EPISÓDIOS','ÁREA VIP','SAIR'];
const scriptPath=path.resolve(__dirname,'../supporter-dashboard-real-v2.js');
(async()=>{
 const script=process.env.TEST_LIVE_ASSETS==='1'?await (await fetch('https://osurtoartificial.com.br/supporter-dashboard-real-v2.js')).text():fs.readFileSync(scriptPath,'utf8');
 for(const [engine,driver,options] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['WebKit',webkit,{}]]){
 const browser=await driver.launch({headless:true,...options});
 try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<h1>Checkout Asaas simulado</h1>'}));
 await page.goto('https://upgrade.test');
 await page.setContent(`<body style="margin:0;background:#0b0d13;color:#f5f5f5;font-family:Arial"><main style="padding:20px"><nav><div style="display:flex;gap:12px;overflow:auto">${tabs.map(t=>`<div style="flex-shrink:0;cursor:pointer">${t}</div>`).join('')}</div></nav></main></body>`);
 await page.evaluate(()=>{
  window.payments=[];window.failNext=false;window.upgradePaid=false;
  window.model={ok:true,user:{id:'test-user',displayName:'Apoiador Teste'},currentSupport:{id:'paid-support',tier:'supporter',amount:50,billing_mode:'one_time'},currentTier:'supporter',currentCredit:50,upgrades:[{tier:'highlight',label:'Apoiador Destaque',fullPrice:100,amountDue:50,available:true},{tier:'vip',label:'Apoiador VIP',fullPrice:300,amountDue:250,available:true}],supports:[],appearances:[],episodes:[],publicityProfile:null,vipAccess:false};
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'test-user'}}}})},functions:{invoke:async(name,{body})=>{
   if(name==='supporter-dashboard-data'){if(window.upgradePaid){window.model.currentTier='vip';window.model.currentSupport.tier='vip';window.model.vipAccess=true;window.model.upgrades=[]}return {data:window.model}}
   if(name!=='asaas-create-support-payment')throw Error('Unexpected function '+name);
   window.payments.push(body);
   await new Promise(r=>setTimeout(r,100));
   if(window.failNext){window.failNext=false;return {error:{context:{json:async()=>({error:'Confira o CPF informado.'})}}}}
   if(!body.cpfCnpj||!body.fullName||body.upgradeFromSupportId!=='paid-support')throw Error('Missing checkout data');
   const data={ok:true,supportId:'upgrade-simulated',amount:body.tier==='vip'?250:50,invoiceUrl:'https://www.asaas.com/i/checkout-simulado'};
   if(body.method==='pix')data.pix={encodedImage:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WAAAAABJRU5ErkJggg==',payload:'PIX-SIMULADO'};
   return {data};
  }}};
  window.supabase={createClient:()=>client};window.getSurtoSupabaseClient=()=>client;
 });
 await page.addScriptTag({content:script});
 await page.locator('#surto-supporter-real-v2').waitFor();
 await page.evaluate(()=>window.__surtoOpenUpgrade());
 await page.locator('[data-upgrade-tier="highlight"]').click();
 await page.locator('#sd-upgrade-form').waitFor();
 assert.equal(await page.evaluate(()=>window.payments.length),0,'selecting category must not create payment');
 assert.equal(await page.locator('[data-upgrade-method]').count(),2);
 assert.match(await page.locator('#surto-supporter-real-v2').innerText(),/50,00/);
 await page.locator('#sd-upgrade-cpf').fill('123');await page.locator('#sd-create-upgrade').click();
 assert.match(await page.locator('#sd-upgrade-msg').innerText(),/CPF/);
 assert.equal(await page.evaluate(()=>window.payments.length),0);
 await page.locator('#sd-upgrade-cpf').fill('12345678901');
 await page.locator('[data-upgrade-method="cartao"]').click();
 assert.equal(await page.locator('#sd-upgrade-cpf').inputValue(),'12345678901');
 assert.match(await page.locator('#sd-create-upgrade').innerText(),/CARTÃO/);
 assert.equal(await page.locator('input[autocomplete="cc-number"]').count(),0);
 await page.locator('[data-upgrade-method="pix"]').click();
 await page.evaluate(()=>window.failNext=true);await page.locator('#sd-create-upgrade').click();
 await page.waitForFunction(()=>document.querySelector('#sd-upgrade-msg')?.textContent==='Confira o CPF informado.');
 assert.equal(await page.locator('#sd-upgrade-cpf').inputValue(),'12345678901');
 await page.locator('#sd-create-upgrade').click();
 await page.getByAltText('QR Code Pix').waitFor();
 assert.equal(await page.evaluate(()=>window.payments.length),2);
 await page.locator('#sd-refresh-upgrade').click();
 await page.waitForFunction(()=>document.querySelector('#sd-upgrade-status')?.textContent.includes('ainda não'));
 assert.equal(await page.evaluate(()=>window.payments.length),2,'status check does not create another charge');
 await page.evaluate(()=>document.querySelector('nav').querySelectorAll('div')[7].click());
 await page.locator('#sd-upgrade-vip').waitFor();await page.locator('#sd-upgrade-vip').click();
 await page.locator('#sd-upgrade-form').waitFor();
 assert.equal(await page.evaluate(()=>window.payments.length),2,'VIP CTA opens form only');
 assert.match(await page.locator('#surto-supporter-real-v2').innerText(),/250,00/);
 assert.equal(await page.locator('[data-upgrade-tier="highlight"]').count(),0);
 await page.locator('[data-upgrade-back]').click();await page.locator('#sd-upgrade-vip').waitFor();await page.locator('#sd-upgrade-vip').click();
 await page.locator('#sd-upgrade-cpf').fill('12345678901');
 await page.locator('[data-upgrade-method="cartao"]').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${engine} ${width} overflow`);
 if(process.env.QA_OUTPUT)await page.screenshot({path:path.join(process.env.QA_OUTPUT,`upgrade-${engine}-${width}.png`),fullPage:true});
 const requestPromise=page.waitForRequest('https://www.asaas.com/i/checkout-simulado');
 const bodyPromise=page.waitForFunction(()=>window.payments.length===3).then(()=>page.evaluate(()=>window.payments[2]));
 await page.locator('#sd-create-upgrade').click();
 const sent=await bodyPromise;
 assert.deepEqual(sent,{tier:'vip',method:'cartao',cpfCnpj:'12345678901',fullName:'Apoiador Teste',upgradeFromSupportId:'paid-support'});
 await requestPromise;
 assert.deepEqual(errors,[]);
 console.log(`PASS ${engine} ${width}: category/VIP → checkout; CPF validation; Pix/card payloads; error retry; pending status; secure card redirect; no overflow`);
 await page.close();
 }}finally{await browser.close()}
 }
})().catch(error=>{console.error(error);process.exitCode=1});
