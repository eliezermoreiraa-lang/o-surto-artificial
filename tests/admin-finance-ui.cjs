// Run with PLAYWRIGHT_MODULE pointing to an installed playwright package.
// The isolated browser receives synthetic data only; no production login or payment is made.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixture = {
  ok: true, users: [], profiles: [], publicity: [], vipBriefings: [], appearances: [], episodes: [], productions: [], emails: [], reminders: { enabled: true, days: 30 },
  subscriptions: [{id:'monthly',user_id:'a',tier:'supporter',amount:50,status:'active',next_due_date:'2026-10-08'}],
  supports: [
    { id: 'one', user_id: 'a', tier: 'supporter', amount: 50, payment_status: 'paid', paid_at: '2026-08-20T15:00:00Z' },
    { id: 'two', user_id: 'b', tier: 'vip', amount: 300, payment_status: 'paid', paid_at: '2026-09-02T15:00:00Z' },
    { id: 'three', user_id: 'b', tier: 'supporter', amount: 50, payment_status: 'pending' },
  ],
};
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-09-08T15:00:00Z') });
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'finance.test') return route.fulfill({ body: '', contentType: 'text/plain' });
        const name = url.pathname === '/admin' ? 'admin.html' : url.pathname.slice(1);
        const allowed = ['admin.html', 'admin-production.js', 'admin-finance.js', 'admin-production.css', 'admin-finance.css', 'admin-episodes.css', 'assets-min/logo-surto.png'];
        if (!allowed.includes(name)) return route.fulfill({ status: 404, body: '' });
        const body = fs.readFileSync(path.join(root, name));
        const contentType = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html';
        await route.fulfill({ body, contentType });
      });
      await page.addInitScript(data => {
        let calls = 0;
        const session = { user: { email: 'admin@example.test' } };
        window.supabase = { createClient: () => ({
          functions: { invoke: async (name, request) => { if (name !== 'admin-production' || request.body.action !== 'dashboard') throw new Error('Unexpected request'); window.dashboardCalls = ++calls; return { data }; } },
          auth: { onAuthStateChange() {}, getSession: async () => ({ data: { session } }) },
        }) };
      }, fixture);
      await page.goto('https://finance.test/admin');
      await page.locator('#financeTitle').waitFor();
      assert.match(await page.locator('.finance-overview').innerText(),/Assinaturas mensais/);
      assert.match(await page.locator('.finance-overview').innerText(),/50,00\/mês contratados/);
      assert.match(await page.locator('.finance-overview').innerText(),/08\/10\/2026/);
      assert.equal(await page.locator('#financeMonth').inputValue(), '2026-09');
      assert.match(await page.locator('.finance-stats').innerText(), /300,00/);
      await page.locator('#financeMonth').fill('2026-08');
      assert.match(await page.locator('.finance-period h3').innerText(), /agosto/i);
      assert.match(await page.locator('.finance-stats').innerText(), /50,00/);
      await page.locator('[data-finance-period="last30"]').click();
      assert.match(await page.locator('.finance-stats').innerText(), /350,00/);
      await page.locator('[data-finance-month="2026-09"]').click();
      assert.match(await page.locator('.finance-stats').innerText(), /300,00/);
      await page.locator('#financeMonth').fill('2026-07');
      assert.match(await page.locator('.finance-empty').innerText(), /Nenhum apoio/);
      await page.locator('[data-finance-period="month"]').click();
      await page.locator('#refreshFinance').click();
      await page.locator('#financeTitle').waitFor();
      assert.equal(await page.evaluate(() => window.dashboardCalls), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Page must not overflow horizontally');
      assert.equal(await page.locator('.finance-history').evaluate(el => el.scrollWidth > el.clientWidth), false, 'Monthly amounts must be visible without horizontal scrolling');
      assert.deepEqual(errors, []);
      if (process.env.FINANCE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.FINANCE_SCREENSHOTS, `admin-finance-${width}.png`), fullPage: true });
      console.log(`PASS ${width}px: current month, previous month, last 30 days, history, empty month, refresh, no page errors/overflow`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
