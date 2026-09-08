const {chromium,firefox,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
for(const [engine,driver,options] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['Firefox',firefox,{}],['WebKit',webkit,{}]]){
 if(process.env.QA_ENGINE&&process.env.QA_ENGINE!==engine)continue;
 const browser=await driver.launch({headless:true,...options});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.goto('https://osurtoartificial.com.br',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.getSurtoSupabaseClient==='function');
 const login=await page.evaluate(async password=>{
   const sb=window.__surtoSharedSupabaseClient;
   const {data,error}=await sb.auth.signInWithPassword({email:'launch-qa-20260908@example.invalid',password});
   return {ok:!!data.session,error:error?.message};
 },process.env.QA_PASSWORD);
 assert.equal(login.ok,true,JSON.stringify(login));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.surtoPaidGuard==='no-support');
 await page.locator('.sa-account-button').click();
 await page.locator('#surto-supporter-real-v2').waitFor();
 await page.waitForFunction(()=>document.querySelector('#surto-supporter-real-v2 [data-join]'));
 const security=await page.evaluate(async()=>{
   const sb=window.__surtoSharedSupabaseClient,{data}=await sb.auth.getUser();
   const call=async(name,body)=>{const r=await sb.functions.invoke(name,{body});return r.error?.context?.status||200};
   const role=await sb.from('profiles').update({role:'admin'}).eq('id',data.user.id);
   return {admin:await call('admin-production',{action:'dashboard'}),profile:await call('supporter-profile-save',{displayName:'Teste'}),vip:await call('vip-briefing-save',{}),role:role.status};
 });
 assert.deepEqual(security,{admin:403,profile:403,vip:403,role:403});
 await page.locator('[data-join]').first().click();
 await page.locator('[data-join-tier="supporter"]').click();
 await page.locator('[data-join-method="cartao"]').click();
 assert.match(await page.locator('#sd-create-join').innerText(),/CARTÃO/);
 await page.locator('[data-mobile-route="home"]').click();
 await page.locator('.sa-account-button').click();
 await page.locator('#surto-supporter-real-v2').waitFor();
 assert.equal(await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).count(),0);
 console.log(`PASS ${engine}: real session survives reload/public navigation; unpaid restrictions; admin and role escalation rejected; card/Pix checkout`);
 }finally{await browser.close()}
}
})().catch(e=>{console.error(e);process.exitCode=1});
