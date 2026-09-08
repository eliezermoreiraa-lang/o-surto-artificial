// Isolated browser checkout: actual frontend scripts, mocked payment transport, no real charges.
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),origin='https://osurtoartificial.com.br';
(async()=>{
 for(const [name,driver,options] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['WebKit',webkit,{}]]){
  const browser=await driver.launch({headless:true,...options});
  try{for(const width of [390,1440]){for(const method of ['pix','cartao']){
   const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let paid=false;
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname.endsWith('asaas.com'))return route.fulfill({contentType:'text/html',body:'<h1>Mock Asaas</h1>'});
    if(u.pathname.endsWith('/asaas-guest-support')){
     assert.equal(route.request().headers().authorization,undefined);
     const b=route.request().postDataJSON();calls.push(b);
     await new Promise(r=>setTimeout(r,150));
     return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,state:'ready',amount:10.25,method,invoiceUrl:'https://www.asaas.com/i/guest-test',paymentStatus:paid?'paid':'pending',pix:method==='pix'?{payload:'pix-simulado',encodedImage:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WAAAAABJRU5ErkJggg=='}:undefined})});
    }
    if(u.hostname!==new URL(origin).hostname)return route.abort();
    if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0b0d12;color:white;margin:20px}*{box-sizing:border-box}</style><link rel="stylesheet" href="/club-support.css"><main class="club-page"><section id="guest-club-checkout" hidden></section></main><script src="/club-support.js"></script><script src="/guest-support.js"></script>'});
    const file=path.resolve(root,'.'+u.pathname);
    if(file.startsWith(root+path.sep)&&fs.existsSync(file))return process.env.TEST_LIVE_ASSETS==='1'?route.continue():route.fulfill({path:file,contentType:{'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]});
    return route.abort();
   });
   await page.goto(origin);await page.evaluate(()=>SurtoGuest.open(()=>window.accountOptional=true));
   assert.equal(await page.locator('#guest-amount').inputValue(),'10,00');
   await page.locator('#guest-account-optional').click();assert.equal(await page.evaluate(()=>window.accountOptional),true);
   await page.locator('#guest-name').fill('Teste Sem Conta');await page.locator('#guest-cpf').fill('52998224725');
   await page.locator('#guest-amount').fill('');await page.locator('#guest-amount').pressSequentially('1025');
   assert.equal(await page.locator('#guest-amount').inputValue(),'10,25');
   await page.locator('[name=guest-method][value='+method+']').check();
   assert.equal(calls.length,0,'no charge until explicit submit');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   await page.locator('#guest-support-form').evaluate(form=>{form.requestSubmit();form.requestSubmit()});
   if(method==='cartao')await page.waitForURL('https://www.asaas.com/i/guest-test');
   else{
    await page.getByAltText('QR Code Pix').waitFor();
    assert.equal(await page.locator('#guest-account-optional').isVisible(),false);
    paid=true;await page.locator('#guest-check').click();await page.getByText('APOIO CONFIRMADO. MUITO OBRIGADO!',{exact:true}).waitFor();
    await page.getByRole('button',{name:'FAZER OUTRO APOIO LIVRE'}).click();await page.locator('#guest-support-form').waitFor();
   }
   const creates=calls.filter(x=>x.action==='create');assert.equal(creates.length,1);assert.equal(creates[0].amount,10.25);assert.equal(creates[0].tier,'free');assert.equal(creates[0].email,'');assert.equal(creates[0].method,method);assert.match(creates[0].requestToken,/^[a-f0-9]{64}$/);
   assert.deepEqual(errors,[]);console.log('PASS '+name+' '+width+' '+method+': guest/no auth, optional account, exact cents, one charge, safe payment, no overflow');await page.close();
  }}}finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
