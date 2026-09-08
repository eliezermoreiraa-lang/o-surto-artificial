// Real page/renderer with isolated authentication and payments. No financial network calls.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function fakeSupabase(){
 const callbacks=[];
 window.qaPayments=[];window.qaPaid=false;
 window.qaSession=null;
 const user={id:'club-test-user',email:'test@example.invalid',user_metadata:{full_name:'Teste Clube'}};
 window.qaLogin=()=>{window.qaSession={user,access_token:'mock'};callbacks.forEach(f=>f('SIGNED_IN',window.qaSession))};
 const query=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve({data:[],error:null}).then(resolve):()=>query});
 const client={from:()=>query,rpc:async()=>({data:[],error:null}),auth:{
  getSession:async()=>({data:{session:window.qaSession}}),
  onAuthStateChange:fn=>{callbacks.push(fn);return {data:{subscription:{unsubscribe(){}}}}},
  signInWithOAuth:async()=>({data:{},error:null}),
  signOut:async()=>{window.qaSession=null;callbacks.forEach(f=>f('SIGNED_OUT',null));return {}}
 },functions:{invoke:async(name,{body})=>{
  if(name==='supporter-dashboard-data')return {data:{ok:true,user:{...user,displayName:'Teste Clube'},currentSupport:window.qaPaid?{id:'paid',tier:'supporter',amount:50}:null,currentTier:window.qaPaid?'supporter':null,currentCredit:window.qaPaid?50:0,upgrades:window.qaPaid?[{tier:'highlight',label:'Apoiador Destaque',fullPrice:100,amountDue:50,available:true},{tier:'vip',label:'Apoiador VIP',fullPrice:300,amountDue:250,available:true}]:[],supports:[],appearances:[],episodes:[],vipAccess:false}};
  if(name!=='asaas-create-support-payment')return {data:{ok:true}};
  window.qaPayments.push(body);
  await window.qaRecordPayment(body);
  return {data:{ok:true,amount:body.amount,supportId:'simulated',invoiceUrl:'https://www.asaas.com/i/mock',pix:body.method==='pix'?{payload:'mock',encodedImage:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WAAAAABJRU5ErkJggg=='}:undefined}};
 }}};
 window.supabase={createClient:()=>client};
}
(async()=>{
 for(const [engine,driver,options] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['WebKit',webkit,{}]]){
 const browser=await driver.launch({headless:true,...options});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],payments=[];
  await page.exposeFunction('qaRecordPayment',body=>payments.push(body));
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname.includes('youtube')||url.hostname==='jnn-pa.googleapis.com')return route.fulfill({contentType:'text/html',body:''});
   if(url.hostname.endsWith('supabase.co'))return route.fulfill({contentType:'application/json',body:'[]'});
   if(url.pathname.includes('/supabase-js@'))return route.fulfill({contentType:'application/javascript',body:'('+fakeSupabase.toString()+')()'});
   if(url.hostname.endsWith('asaas.com'))return route.fulfill({contentType:'text/html',body:'<h1>Asaas simulado</h1>'});
   if(url.hostname==='osurtoartificial.com.br'&&process.env.TEST_LIVE_ASSETS!=='1'){
    const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
     const type={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[path.extname(file)];
     return route.fulfill({path:file,contentType:type});
    }
   }
   if(route.request().method()!=='GET')return route.abort();
   return route.continue();
  });
  await page.goto('https://osurtoartificial.com.br',{waitUntil:'domcontentloaded'});
  const publicClub=()=>page.locator('.sa-site-header').getByText(width<1080?'Clube':'Clube do Surto',{exact:true}).click();
  await publicClub();
  await page.locator('.club-plan').first().waitFor();
  assert.equal(await page.locator('.club-plan').count(),4);
  assert.equal(await page.locator('.club-seal').count(),4);
  assert.equal(await page.locator('.club-plan button').count(),4);
  assert.match(await page.locator('.club-monthly').innerText(),/assinatura automática ainda não/);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.club-seal')).every(img=>img.complete&&img.naturalWidth>0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'public overflow');
  if(process.env.QA_OUTPUT)await page.screenshot({path:path.join(process.env.QA_OUTPUT,'club-'+engine+'-'+width+'.png'),fullPage:true});
  for(const tier of ['APOIADOR','APOIADOR DESTAQUE','APOIADOR VIP']){
   await page.getByRole('button',{name:'Escolher '+tier,exact:true}).click();
   await page.locator('.guest-account-dialog').waitFor();
   assert.match(await page.locator('.guest-account-dialog').innerText(),/notificações corretamente/);
   if(tier==='APOIADOR VIP'){
    await page.locator('#guest-account-continue').click();
    await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).waitFor();
    await publicClub();
   }else await page.locator('#guest-account-back').click();
  }
  await page.getByRole('button',{name:'Escolher APOIO LIVRE',exact:true}).click();
  await page.locator('#guest-support-form').waitFor();
  if(process.env.QA_OUTPUT)await page.screenshot({path:path.join(process.env.QA_OUTPUT,'club-guest-'+engine+'-'+width+'.png'),fullPage:true});
  assert.equal(await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).count(),0);
  await page.locator('#guest-account-optional').click();
  await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.qaPayments.length),0);
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('surto-club-checkout')).tier),'free');
  // Simulate successful authentication completion, not a real Google login.
  await page.evaluate(()=>window.qaLogin());
  await page.locator('#sd-join-amount[type=text]').waitFor();
  assert.equal(await page.locator('#sd-join-amount').inputValue(),'10,00');
  for(const [digits,expected] of [['1025','10,25'],['1000','10,00'],['10000','100,00'],['100000','1.000,00'],['100025','1.000,25']]){
   await page.locator('#sd-join-amount').fill('');await page.locator('#sd-join-amount').pressSequentially(digits);
   assert.equal(await page.locator('#sd-join-amount').inputValue(),expected);
  }
  await page.locator('#sd-join-amount').fill('10,25');
  await page.locator('#sd-join-cpf').fill('12345678901');
  await page.locator('[data-join-method=cartao]').click();
  assert.equal(await page.locator('#sd-join-amount').inputValue(),'10,25');
  await page.locator('[data-join-method=pix]').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'checkout overflow');
  if(process.env.QA_OUTPUT)await page.screenshot({path:path.join(process.env.QA_OUTPUT,'club-checkout-'+engine+'-'+width+'.png'),fullPage:true});
  await page.locator('#sd-create-join').click();await page.getByAltText('QR Code Pix').waitFor();
  assert.equal(await page.evaluate(()=>window.qaPayments[0].amount),10.25);
  assert.equal(await page.evaluate(()=>window.qaPayments[0].tier),'free');
  await publicClub();await page.getByRole('button',{name:'Escolher APOIADOR DESTAQUE',exact:true}).click();
  await page.locator('#sd-join-cpf').waitFor();
  assert.equal(await page.locator('#sd-join-amount').inputValue(),'100');
  assert.equal(await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).count(),0,'must keep session');
  await page.evaluate(()=>window.qaPaid=true);
  await publicClub();await page.getByRole('button',{name:'Escolher APOIADOR VIP',exact:true}).click();
  await page.locator('[data-upgrade-tier=vip]').waitFor();
  assert.equal(payments.length,1,'paid supporter must enter upgrade without new charge');
  await page.evaluate(()=>window.qaPaid=false);
  await publicClub();await page.getByRole('button',{name:'Escolher APOIO LIVRE',exact:true}).click();
  await page.locator('#guest-account-optional').click();
  await page.locator('#sd-join-amount[type=text]').waitFor();
  await page.locator('#sd-join-amount').fill('100025');await page.locator('#sd-join-cpf').fill('12345678901');
  await page.locator('[data-join-method=cartao]').click();
  let cardAmount;
  page.on('request',req=>{if(req.url()==='https://www.asaas.com/i/mock')cardAmount=true});
  await page.locator('#sd-create-join').click();
  await page.waitForURL('https://www.asaas.com/i/mock');
  assert.ok(cardAmount);
  assert.equal(payments[1].method,'cartao');
  assert.equal(payments[1].amount,1000.25);
  assert.deepEqual(errors,[],errors.join('\n'));
  console.log('PASS '+engine+' '+width+': public 4 cards/seals, login intent, BRL cents, Pix payload, session preserved, card redirect, no overflow');
  await page.close();
 }}finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
