const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{for(const [name,driver,options] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['WebKit',webkit,{}]]){
 const browser=await driver.launch({headless:true,...options});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 if(process.env.TEST_LIVE_ASSETS!=='1')await page.route('**/mobile-experience-v2.js*',route=>route.fulfill({path:require('node:path').resolve('mobile-experience-v2.js'),contentType:'application/javascript'}));
 if(process.env.TEST_LIVE_ASSETS!=='1')await page.route('**/supporter-dashboard-guard.js*',route=>route.fulfill({path:require('node:path').resolve('supporter-dashboard-guard.js'),contentType:'application/javascript'}));
 await page.goto('https://osurtoartificial.com.br',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__surtoSharedSupabaseClient);
 const ok=await page.evaluate(async password=>{const r=await window.__surtoSharedSupabaseClient.auth.signInWithPassword({email:'launch-qa-20260908@example.invalid',password});return !!r.data.session},process.env.QA_PASSWORD);assert.equal(ok,true);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.surtoPaidGuard==='paid');
 await page.locator('.sa-account-button').click();const root=page.locator('#surto-supporter-real-v2');await root.waitFor();
 for(const label of ['MEUS APOIOS','MINHAS APARIÇÕES','PERFIL DE DIVULGAÇÃO','MINHA ASSINATURA','MEUS EPISÓDIOS','ÁREA VIP','INÍCIO']){
  await page.evaluate(label=>{const el=Array.from(document.querySelectorAll('div')).find(e=>e.textContent.trim().toUpperCase()===label&&e.getBoundingClientRect().width>0&&!e.closest('.sa-site-header'));if(!el)throw Error('Missing tab '+label);el.click()},label);
  await page.waitForFunction(label=>{const r=document.querySelector('#surto-supporter-real-v2');const title=r?.querySelector('h1')?.textContent.trim().toUpperCase();return r&&!/Carregando|CARREGANDO/.test(r.innerText)&&(label==='INÍCIO'?!!r.querySelector('.sd-hero'):title===label)},label).catch(async error=>{console.error('TAB',label,await root.innerText());throw error});
  if(label==='PERFIL DE DIVULGAÇÃO'){await page.waitForFunction(()=>document.querySelector('#surto-supporter-real-v2')?.innerText.includes('MATERIAL ENVIADO'));assert.equal(await root.locator('input[type="text"]').count(),0)}
  if(label==='ÁREA VIP'){await page.locator('#sd-vip-goal').waitFor().catch(async error=>{console.error(await root.innerText());throw error});assert.equal(await page.locator('#sd-vip-goal').inputValue(),'Teste de divulgação')}
 }
 assert.match(await root.innerText(),/Bem-vindo de volta/);
 await page.locator('[data-mobile-route="home"]').click();
 await page.locator('.sa-hero-cta').click();
 await root.waitFor();
 await page.waitForFunction(()=>document.querySelector('#surto-supporter-real-v2')?.innerText.includes('CATEGORIA MÁXIMA'));
 assert.equal(await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).count(),0);
 console.log(`PASS ${name}: all seven paid supporter tabs, completed profile read-only, saved VIP briefing, home navigation`);
 }finally{await browser.close()}
}})().catch(e=>{console.error(e);process.exitCode=1});
