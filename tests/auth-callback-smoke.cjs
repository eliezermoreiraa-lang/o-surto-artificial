const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'surto-shared-supabase.js'), 'utf8');

async function run(url, setSessionResult) {
  let createCount = 0;
  let setSessionCount = 0;
  let replacedUrl = '';
  const client = {
    auth: {
      setSession: async credentials => {
        setSessionCount += 1;
        assert.equal(credentials.access_token, 'test-access');
        assert.equal(credentials.refresh_token, 'test-refresh');
        return setSessionResult;
      }
    }
  };
  const window = {
    location: { href: url },
    history: { replaceState: (_state, _title, next) => { replacedUrl = next; } },
    supabase: { createClient: () => { createCount += 1; return client; } }
  };
  const document = { documentElement: { dataset: {} }, title: 'O Surto Artificial' };
  const context = vm.createContext({ window, document, URL, URLSearchParams, Error, Promise, setTimeout });
  vm.runInContext(source, context);
  const result = await window.__surtoOAuthReady;
  return { window, document, result, replacedUrl, createCount, setSessionCount };
}

(async () => {
  const session = { user: { id: 'test-user' }, access_token: 'test-access', refresh_token: 'test-refresh' };
  const callback = await run('https://osurtoartificial.com.br/#access_token=test-access&refresh_token=test-refresh&expires_in=3600', { data: { session }, error: null });
  assert.equal(callback.createCount, 1);
  assert.equal(callback.setSessionCount, 1);
  assert.equal(callback.result.ok, true);
  assert.equal(callback.window.__surtoOAuthCompleted, true);
  assert.equal(callback.document.documentElement.dataset.surtoAuthCallback, 'success');
  assert.equal(callback.replacedUrl, '/?oauth=success');

  const regular = await run('https://osurtoartificial.com.br/', { data: null, error: null });
  assert.equal(regular.createCount, 1);
  assert.equal(regular.setSessionCount, 0);
  assert.equal(regular.result.ok, true);
  assert.equal(regular.result.callback, false);

  const denied = await run('https://osurtoartificial.com.br/#error=access_denied&error_description=Denied', { data: null, error: null });
  assert.equal(denied.setSessionCount, 0);
  assert.equal(denied.result.ok, false);
  assert.equal(denied.result.callback, true);
  assert.equal(denied.document.documentElement.dataset.surtoAuthCallback, 'error');
  assert.equal(denied.replacedUrl, '/?oauth_error=1');

  console.log('auth callback smoke: ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
