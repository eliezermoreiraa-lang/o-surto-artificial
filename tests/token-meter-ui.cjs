const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const origin = 'https://osurtoartificial.com.br';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let meter = { progress_percent: 0, level: 'low' }, fail = false, calls = 0;
      await page.route('**/rest/v1/token_meter_public?**', route => {
        calls++;
        return route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? {} : [meter]), headers: { 'Access-Control-Allow-Origin': '*' } });
      });
      if (!process.env.TEST_LIVE_ASSETS) await page.route(`${origin}/**`, async route => {
        const url = new URL(route.request().url());
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        if (!['index.html', 'token-meter.js', 'token-meter.css'].includes(file)) return route.continue();
        return route.fulfill({ body: fs.readFileSync(path.join(root, file)), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
      });
      await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const card = page.locator('[data-token-meter]');
      await page.waitForFunction(() => document.querySelector('[data-token-track]')?.getAttribute('aria-valuenow') === '0', null, { timeout: 30000 });
      await card.scrollIntoViewIfNeeded();
      assert.equal(await card.getAttribute('data-level'), 'low');
      assert.equal(await card.innerText().then(text => /R\$|2\.000|200,00/.test(text)), false);
      const order = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        return rect('.sa-hero-poster').bottom <= rect('.sa-token-section').top && rect('.sa-token-section').bottom <= rect('.sa-home-story').top;
      });
      assert.equal(order, true, 'meter belongs below poster and before story');
      for (const [percent, level] of [[50, 'building'], [90, 'ready'], [100, 'ready'], [0, 'low']]) {
        meter = { progress_percent: percent, level };
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(p => document.querySelector('[data-token-track]')?.getAttribute('aria-valuenow') === String(p), percent);
        assert.equal(await card.getAttribute('data-level'), level);
      }
      fail = true;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.locator('[data-token-retry]').waitFor({ state: 'visible' });
      fail = false;
      await page.locator('[data-token-retry]').click();
      await page.locator('[data-token-retry]').waitFor({ state: 'hidden' });
      assert.ok(calls >= 7);
      const box = await card.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      if (process.env.FINANCE_SCREENSHOTS) await card.screenshot({ path: path.join(process.env.FINANCE_SCREENSHOTS, `token-meter-${width}.png`) });
      await card.locator('.sa-token-cta').click();
      await page.waitForFunction(() => !document.querySelector('[data-token-meter]'));
      const nav = width < 1080 ? '[data-mobile-route="exibicao"]' : '[data-nav-item="exibicao"]';
      await page.locator(nav).first().click();
      await page.locator('.sa-next-production').waitFor({ state: 'visible' });
      assert.match(await page.locator('body').innerText(), /Série finalizada/i);
      assert.match(await page.locator('.sa-next-production').innerText(), /Em breve: Lalinha do Bairro/i);
      assert.equal(await page.locator('.sa-next-badges span').count(), 2);
      const home = width < 1080 ? '[data-mobile-route="home"]' : '[data-nav-item="home"]';
      await page.locator(home).first().click();
      await card.waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('[data-token-track]')?.getAttribute('aria-valuenow') === '0');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: full site mounts, placement, colors, privacy, failed request/retry, CTA/navigation, finished/upcoming productions, no JS errors`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
