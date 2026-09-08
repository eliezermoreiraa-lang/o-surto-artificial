const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function fake(){
  const user={id:'qa-owner',email:'qa@example.invalid',user_metadata:{full_name:'Teste Mensal'}},callbacks=[];
  let session=sessionStorage.getItem('qa-monthly-login')?{user,access_token:'mock'}:null;
  window.qaLogin=()=>{session={user,access_token:'mock'};sessionStorage.setItem('qa-monthly-login','1');callbacks.forEach(f=>f('SIGNED_IN',session))};
  const query=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve({data:[],error:null}).then(resolve):()=>query});
  const client={from:()=>query,rpc:async()=>({data:[]}),auth:{getSession:async()=>({data:{session}}),onAuthStateChange:f=>{callbacks.push(f);return {data:{subscription:{unsubscribe(){}}}}},signInWithOAuth:async()=>({data:{}})},functions:{invoke:async(name,{body})=>{
    if(name==='supporter-dashboard-data')return {data:await window.qaModel()};
    if(name==='asaas-monthly-support')return {data:await window.qaMonthly(body)};
    return {data:{ok:true}};
  }}};
  window.supabase={createClient:()=>client};
}
(async()=>{
  for(const [engine,driver,opts] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['WebKit',webkit,{}]]){
    const browser=await driver.launch({headless:true,...opts});
    try{for(const width of [390,1440]){
      const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],calls=[];
      let contract=null;
      await page.exposeFunction('qaModel',()=>({ok:true,user:{id:'qa-owner',displayName:'Teste Mensal'},currentSupport:null,supports:[],appearances:[],episodes:[],upgrades:[],subscription:contract&&contract.status!=='cancelled'?contract:null,subscriptions:contract?[contract]:[]}));
      await page.exposeFunction('qaMonthly',body=>{calls.push(body);if(body.action==='create'){contract={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',tier:body.tier,amount:50,status:'active',started_at:'2026-09-08',next_due_date:'2026-10-08'};return {ok:true,invoiceUrl:'https://asaas.com/checkoutSession/show?id=checkout-mocked'}}contract.status='cancelled';return {ok:true,cancelled:true}});
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',async route=>{
        const u=new URL(route.request().url());
        if(u.hostname.includes('youtube')||u.hostname==='jnn-pa.googleapis.com')return route.fulfill({contentType:'text/html',body:''});
        if(u.hostname.endsWith('supabase.co'))return route.fulfill({contentType:'application/json',body:'[]'});
        if(u.pathname.includes('/supabase-js@'))return route.fulfill({contentType:'application/javascript',body:'('+fake.toString()+')()'});
        if(u.hostname.endsWith('asaas.com'))return route.fulfill({contentType:'text/html',body:'Asaas SIMULADO'});
        if(u.hostname==='osurtoartificial.com.br'&&process.env.TEST_LIVE_ASSETS!=='1'){
          const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
          if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file,contentType:({'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[path.extname(file)]});
        }
        if(route.request().method()!=='GET')return route.abort();
        return route.continue();
      });
      await page.goto('https://osurtoartificial.com.br',{waitUntil:'domcontentloaded'});
      await page.locator('.sa-site-header').getByText(width<1080?'Clube':'Clube do Surto',{exact:true}).click();
      await page.locator('.club-monthly-options button').first().waitFor();
      assert.equal(await page.locator('.club-monthly-options button').count(),3);
      await page.locator('.club-monthly-options button').first().click();
      await page.locator('#guest-account-continue').click();
      await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('surto-club-checkout')).billingMode),'monthly');
      await page.evaluate(()=>window.qaLogin());
      await page.locator('#sd-monthly-form').waitFor();
      assert.equal(calls.length,0);
      assert.equal(await page.locator('#sd-monthly-consent').isChecked(),false);
      await page.locator('#sd-monthly-form button').click();
      assert.equal(calls.length,0,'must require explicit consent');
      assert.equal(await page.locator('input[autocomplete=cc-number]').count(),0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'monthly overflow');
      if(process.env.QA_OUTPUT){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(process.env.QA_OUTPUT,`monthly-${engine}-${width}.png`),fullPage:true})}
      await page.locator('#sd-monthly-consent').check();
      await page.locator('#sd-monthly-form button').click();
      await page.waitForURL('https://asaas.com/**');assert.equal(calls.length,1);assert.equal(calls[0].consent,true);assert.equal(calls[0].tier,'supporter');
      await page.goto('https://osurtoartificial.com.br/?monthly=return',{waitUntil:'domcontentloaded'});
      // Some initial routes land on the public home; open the member area while preserving session.
      if(!(await page.locator('[data-monthly-cancel]').count()))await page.locator('.sa-site-header').getByText(/MINHA ÁREA|ENTRAR/).first().click();
      await page.locator('[data-monthly-cancel]').waitFor();
      assert.match(await page.locator('#surto-supporter-real-v2').innerText(),/08\/10\/2026/);
      page.once('dialog',d=>d.dismiss());await page.locator('[data-monthly-cancel]').click();assert.equal(calls.length,1);
      page.once('dialog',d=>d.accept());await page.locator('[data-monthly-cancel]').click();
      await page.waitForFunction(()=>document.querySelector('#surto-supporter-real-v2')?.textContent.includes('Sem renovação'));
      assert.equal(calls.length,2);assert.equal(calls[1].action,'cancel');
      assert.equal(await page.locator('[data-monthly-cancel]').count(),0);assert.deepEqual(errors,[]);
      console.log(`PASS ${engine} ${width}: monthly auth intent, explicit consent, secure redirect, next due, cancel confirmation, unpaid member management, no overflow`);
      await page.close();
    }}finally{await browser.close()}
  }
})().catch(error=>{console.error(error);process.exit(1)});
