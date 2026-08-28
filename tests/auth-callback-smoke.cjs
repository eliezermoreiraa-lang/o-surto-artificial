const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'surto-shared-supabase.js'), 'utf8');

async function run(url, exchangeResult) {
  let createCount = 0;
  let exchangeCount = 0;
  let replacedUrl = '';
  const client = {
    auth: {
      exchangeCodeForSession: async code => {
        exchangeCount += 1;
        assert.equal(code, 'oauth-code');
        return exchangeResult;
      }
    }
  };
  const window = {
    location: { href: url },
    history: { replaceState: (_state, _title, next) => { replacedUrl = next; } },
    supabase: { createClient: () => { createCount += 1; return client; } }
  };
  const document = { documentElement: { dataset: {} }, title: 'O Surto Artificial' };
  const context = vm.createContext({ window, document, URL, Error, Promise, setTimeout });
  vm.runInContext(source, context);
  const result = await window.__surtoOAuthReady;
  return { window, document, result, replacedUrl, createCount, exchangeCount };
}

(async () => {
  const session = { user: { id: 'test-user' }, access_token: 'test-access', refresh_token: 'test-refresh' };
  const callback = await run('https://osurtoartificial.com.br/?code=oauth-code', { data: { session }, error: null });
  assert.equal(callback.createCount, 1);
  assert.equal(callback.exchangeCount, 1);
  assert.equal(callback.result.ok, true);
  assert.equal(callback.window.__surtoOAuthCompleted, true);
  assert.equal(callback.document.documentElement.dataset.surtoAuthCallback, 'success');
  assert.equal(callback.replacedUrl, '/?oauth=success');

  const regular = await run('https://osurtoartificial.com.br/', { data: null, error: null });
  assert.equal(regular.createCount, 1);
  assert.equal(regular.exchangeCount, 0);
  assert.equal(regular.result.ok, true);
  assert.equal(regular.result.callback, false);

  console.log('auth callback smoke: ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
