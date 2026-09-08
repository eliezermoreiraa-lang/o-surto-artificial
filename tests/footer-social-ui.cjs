const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const expected = [
  ['Instagram', 'https://www.instagram.com/osurtoartificial/'],
  ['YouTube', 'https://www.youtube.com/@osurtoartificial'],
  ['TikTok', 'https://www.tiktok.com/@osurtoartificial'],
];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, reducedMotion: 'reduce' });
      // Capture outgoing navigation without depending on social sites' login/captcha walls.
      await context.route(/https:\/\/www\.(instagram|youtube|tiktok)\.com\/.*/, route => route.fulfill({ contentType: 'text/html', body: '<title>Social navigation target</title>' }));
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (!process.env.TEST_LIVE_ASSETS) await page.route('https://osurtoartificial.com.br/**', route => {
        const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
        if (!['index.html', 'footer-social.css'].includes(name)) return route.continue();
        return route.fulfill({ body: fs.readFileSync(path.join(root, name)), contentType: name.endsWith('.css') ? 'text/css' : 'text/html' });
      });
      await page.goto('https://osurtoartificial.com.br', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('.sa-hero-title') && !document.body.innerText.includes('{{ m.label }}'));
      const socials = page.locator('.sa-footer-social');
      await socials.scrollIntoViewIfNeeded();
      assert.equal(await socials.locator('a').count(), 3);
      for (const [name, url] of expected) {
        const link = socials.getByRole('link', { name: `${name} oficial do Surto — abre em nova aba`, exact: true });
        assert.equal(await link.getAttribute('href'), url);
        assert.match(await link.getAttribute('rel'), /noopener/);
        assert.equal(await link.locator('svg').count(), 1);
        const bounds = await link.boundingBox();
        assert.ok(bounds.width >= 44 && bounds.height >= 44);
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        const popupPromise = page.waitForEvent('popup');
        if (name === 'YouTube') { await link.focus(); await page.keyboard.press('Enter'); }
        else if (width === 390) await link.locator('svg').tap();
        else await link.locator('svg').click();
        const popup = await popupPromise;
        await popup.waitForLoadState('domcontentloaded');
        assert.equal(popup.url(), url);
        await popup.close();
      }
      if (process.env.FINANCE_SCREENSHOTS) await socials.locator('..').screenshot({ path: path.join(process.env.FINANCE_SCREENSHOTS, `footer-social-${width}.png`) });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: three branded icons, accessible names, touch targets, real link destinations, click/tap/keyboard open separate tabs, no JS errors`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
