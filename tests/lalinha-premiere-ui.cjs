const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture=fs.readFileSync(path.join(__dirname,'monthly-ui.cjs'),'utf8');
const fake=fixture.slice(fixture.indexOf('function fake(){'),fixture.indexOf('(async()=>{'));
const handles=['eurebequinhan','biancadellafancy','kayaconky','sarahvikaqueen','fiuk','pabllovittar','liaclark','thaliabombinha','uriasss'];
(async()=>{
 for(const [engine,driver,opts] of [['Chrome',chromium,{channel:'chrome',args:['--no-proxy-server']}],['WebKit',webkit,{}]]){
  const browser=await driver.launch({headless:true,...opts});
  try{for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname.includes('youtube')||u.hostname==='jnn-pa.googleapis.com')return route.fulfill({body:''});
    if(u.hostname.endsWith('supabase.co'))return route.fulfill({contentType:'application/json',body:'[]'});
    if(u.pathname.includes('/supabase-js@'))return route.fulfill({contentType:'application/javascript',body:fake+'\nfake();'});
    if(route.request().method()!=='GET')return route.abort();
    if(u.hostname==='osurtoartificial.com.br'&&process.env.TEST_LIVE_ASSETS!=='1'){
     const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
     if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file,contentType:({'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg','.webp':'image/webp'})[path.extname(file)]});
    }
    return route.continue();
   });
   await page.goto('https://osurtoartificial.com.br',{waitUntil:'domcontentloaded'});
   await page.locator('.sa-hero-label').waitFor();
   assert.match(await page.locator('.sa-hero-label').innerText(),/Lalinha do Bairro no ar/i);
   assert.equal(await page.locator('.sa-hero-label span').last().evaluate(e=>getComputedStyle(e).color),'rgb(74, 222, 128)');
   assert.match(await page.locator('.sa-poster-badges').innerText(),/Em exibição/i);
   assert.match(await page.locator('.sa-poster-badges').innerText(),/Precisando de apoio/i);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home overflow');
   if(process.env.QA_OUTPUT)await page.screenshot({path:path.join(process.env.QA_OUTPUT,`lalinha-home-${engine}-${width}.png`)});
   await page.locator('.sa-site-header').getByText(width<1080?'Exibição':'Em Exibição',{exact:true}).click();
   await page.locator('.sa-lalinha-cast').waitFor();
   await page.locator('h1').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished)));
   await page.locator('img[alt="Lalinha do Bairro — em exibição"]').first().evaluate(img=>img.decode());
   if(process.env.QA_OUTPUT)await page.screenshot({path:path.join(process.env.QA_OUTPUT,`lalinha-exibicao-${engine}-${width}.png`),animations:'disabled'});
   assert.match(await page.locator('h1').innerText(),/LALINHA.*DO BAIRRO/s);
   assert.match(await page.locator('.sa-archive-production').innerText(),/A UrsupaDOLLra/i);
   assert.match(await page.locator('.sa-archive-production').innerText(),/Novela finalizada/i);
   const cards=page.locator('.sa-cast-grid:not(.sa-cast-copy) .sa-cast-card');
   assert.equal(await cards.count(),9);
   assert.deepEqual(await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),handles.map(h=>'https://www.instagram.com/'+h+'/'));
   for(const card of await cards.all()){
    await card.scrollIntoViewIfNeeded();
    await card.locator('img').evaluate(img=>img.decode());
    assert.equal(await card.locator('img').evaluate(img=>img.naturalWidth>0),true);
   }
   assert.equal(await cards.filter({hasText:'Samira Close'}).count(),1);
   assert.equal(await page.locator('.sa-cast-track').evaluate(e=>getComputedStyle(e).animationName),'none','reduced motion');
   assert.ok(await page.locator('.sa-cast-window').evaluate(e=>e.scrollWidth>e.clientWidth),'horizontal carousel');
   await page.locator('.sa-cast-window').evaluate(e=>e.scrollLeft=0);
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.mouse.move(0,0);
   await page.evaluate(()=>document.activeElement.blur());
   const track=page.locator('.sa-cast-track');
   assert.equal(await track.evaluate(e=>getComputedStyle(e).animationName),'saCastMarquee');
   const moving=await track.evaluate(e=>new Promise(resolve=>{
    const before=getComputedStyle(e).transform;
    setTimeout(()=>resolve(before!==getComputedStyle(e).transform),250);
   }));
   assert.equal(moving,true,'automatic movement');
   await page.locator('#sa-cast-pause').check();
   assert.equal(await track.evaluate(e=>getComputedStyle(e).animationPlayState),'paused','pause control');
   await page.locator('#sa-cast-pause').uncheck();
   await cards.first().focus();
   assert.equal(await track.evaluate(e=>getComputedStyle(e).animationPlayState),'paused','pause for keyboard');
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'cast overflow');
   if(process.env.QA_OUTPUT)await page.locator('.sa-lalinha-cast').screenshot({path:path.join(process.env.QA_OUTPUT,`lalinha-cast-${engine}-${width}.png`),style:'.sa-site-header{visibility:hidden!important}'});
   await page.getByText('ENTRAR PARA O CLUBE',{exact:false}).first().click();
   await page.locator('.club-grid').waitFor({timeout:15000});
   assert.deepEqual(errors,[]);
   console.log('PASS',engine,width,process.env.TEST_LIVE_ASSETS==='1'?'production':'local');
   await page.close();
  }}finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
