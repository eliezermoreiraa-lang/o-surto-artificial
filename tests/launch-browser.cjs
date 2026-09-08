const {chromium,firefox,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),origin='https://osurtoartificial.com.br';
const out=process.env.QA_OUTPUT;
(async()=>{
for(const [engine,driver,options] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['Firefox',firefox,{}],['WebKit',webkit,{}]]){
 if(process.env.QA_ENGINE&&process.env.QA_ENGINE!==engine)continue;
 const browser=await driver.launch({headless:true,...options});
 try{for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(origin))failed.push(r.url())});
  if(!process.env.TEST_LIVE_ASSETS)await page.route(origin+'/**',route=>{const name=new URL(route.request().url()).pathname.slice(1)||'index.html';if(!['index.html','launch-polish.css'].includes(name))return route.continue();return route.fulfill({body:fs.readFileSync(path.join(root,name)),contentType:name.endsWith('.css')?'text/css':'text/html'})});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.sa-hero-title')&&!document.body.innerText.includes('{{ m.label }}'));
  await page.locator('.sa-testimonials-grid').waitFor();
  const cards=await page.locator('.sa-testimonials-grid > div').evaluateAll(els=>els.map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})));
  assert.equal(cards.length,6);assert.ok(Math.max(...cards.map(c=>c.height))-Math.min(...cards.map(c=>c.height))<2);
  assert.ok(!(await page.locator('body').innerText()).includes('protótipo de navegação'));
  if(out){await page.locator('.sa-testimonials').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-135));await page.screenshot({path:path.join(out,`comments-fixed-${engine}-${width}.png`)})}
  for(const route of ['exibicao','clube','apoiadores','sobre','contrate','home']){
    const selector=width<1080?`[data-mobile-route="${route}"]`:`[data-nav-item="${route}"]`;
    await page.locator(selector).click();
    await page.waitForFunction(()=>document.querySelector('h1,h2'));
    assert.ok((await page.locator('body').innerText()).length>250,route);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${engine} ${width} ${route} overflow`);
  }
  const account=width<1080?page.locator('.sa-account-button'):page.locator('.sa-header-main').getByText('ENTRAR',{exact:true});
  await account.click();await page.getByText('CONTINUAR COM GOOGLE',{exact:true}).waitFor();
  assert.ok(await page.locator('input[type="email"]').count());
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log(`PASS ${engine} ${width}: six public routes, login, equal comment cards, no overflow/JS errors/failed site requests`);
  await page.close();
 }}finally{await browser.close()}
}
})().catch(e=>{console.error(e);process.exitCode=1});
