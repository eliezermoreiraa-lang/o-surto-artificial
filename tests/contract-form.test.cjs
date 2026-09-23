const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../contract-form.js'), 'utf8');

function fixture(fetchImpl) {
  const placeholders = ['seu nome','voce@email.com','marca, artista, canal…','o surto que você quer ver no ar','ex: 3 semanas','ex: R$ 5.000'];
  const values = ['QA Test','test@example.invalid','Test project','Uma ideia de produção para testar.','3 semanas','R$ 5.000'];
  const inputs = placeholders.map((placeholder, i) => ({
    placeholder, value: values[i], readOnly: false,
    setCustomValidity(s) { this.customError = s; },
    reportValidity() { return !this.customError && (!this.required || this.value.length >= this.minLength) && (this.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)); }
  }));
  const status = { textContent: '', style: {}, append() {} };
  const button = { innerHTML: 'ENVIAR', disabled: false, setAttribute() {}, removeAttribute() {} };
  const trap = { value: '' };
  const root = { querySelector(s) {
    if (s === '[data-contract-status]') return status;
    if (s === '[data-contract-submit]') return button;
    if (s === '[data-contract-trap]') return trap;
    return inputs.find(x => s === `[placeholder="${x.placeholder}"]`);
  }};
  const calls = [], listeners = {}, storage = new Map();
  const context = vm.createContext({
    window: {}, document: { documentElement: {}, querySelector: () => root,
      addEventListener: (name, fn) => listeners[name] = fn,
      createElement: () => ({ style: {} }) },
    sessionStorage: { getItem:k=>storage.get(k), setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k) },
    crypto:webcrypto, TextEncoder, AbortController, setTimeout, clearTimeout,
    MutationObserver: class { observe() {} },
    fetch: async (url, opts) => { calls.push({url, ...JSON.parse(opts.body)}); return fetchImpl(calls.at(-1)); }
  });
  vm.runInContext(source, context);
  return { submit: context.window.SurtoContractForm.submit, inputs, status, button, calls, storage, listeners };
}
const accepted = req => ({ ok:true, json:async()=>({ok:true,id:req.p_id}) });

test('success requires confirmed persistence, clears fields and exposes protocol', async () => {
  const f=fixture(accepted); await f.submit();
  assert.equal(f.calls.length,1); assert.match(f.status.textContent,/Pedido registrado! Protocolo:/);
  assert.ok(f.inputs.every(x=>x.value==='')); assert.equal(f.button.disabled,false);
  assert.equal(f.storage.size,0); assert.equal(f.calls[0].p_payload.email,'test@example.invalid');
  assert.equal(f.calls[0].p_payload.idea,'Uma ideia de produção para testar.');
});
test('required and invalid email fields never call API', async () => {
  for (const [index,value] of [[0,''],[1,'not-an-email'],[3,'short']]) {
    const f=fixture(accepted); f.inputs[index].value=value; await f.submit();
    assert.equal(f.calls.length,0); assert.doesNotMatch(f.status.textContent,/Pedido registrado/);
  }
});
test('uncertain response preserves fields and retry uses the SAME id', async () => {
  let fail=true;
  const f=fixture(req => { if(fail) throw Error('Falha de rede'); return accepted(req); });
  await f.submit(); const first=f.calls[0];
  assert.equal(f.inputs[0].value,'QA Test'); assert.doesNotMatch(f.status.textContent,/Pedido registrado/);
  const saved=f.storage.get('surto-contract-retry');
  assert.ok(!saved.includes('test@example.invalid')); fail=false; await f.submit();
  assert.equal(f.calls[1].p_id,first.p_id); assert.match(f.status.textContent,/Pedido registrado/);
});
test('changed payload receives a different id after failed attempt', async () => {
  const f=fixture(()=>({ok:false,json:async()=>({})}));
  await f.submit(); f.inputs[3].value='Uma outra ideia de produção.'; await f.submit();
  assert.notEqual(f.calls[0].p_id,f.calls[1].p_id);
});
test('double-click is blocked while request is in flight', async () => {
  let release;
  const f=fixture(req=>new Promise(resolve=>{release=()=>resolve(accepted(req));}));
  const pending=f.submit();
  while(!release) await new Promise(resolve=>setImmediate(resolve));
  await f.submit(); assert.equal(f.calls.length,1); assert.equal(f.button.disabled,true);
  release(); await pending; assert.equal(f.button.disabled,false);
});
test('rate limits and malformed successes never show fake success', async () => {
  for (const result of [
    {ok:false,json:async()=>({code:'PT429',message:'Limite de envios atingido.'})},
    {ok:true,json:async()=>({ok:true,id:'wrong-id'})},
    {ok:true,json:async()=>({})}
  ]) {
    const f=fixture(()=>result); await f.submit();
    assert.doesNotMatch(f.status.textContent,/Pedido registrado/);
    assert.equal(f.inputs[0].value,'QA Test'); assert.equal(f.button.disabled,false);
  }
});
test('Enter on a single-line field uses the same submission flow', async () => {
  const f=fixture(accepted); let prevented=false;
  f.listeners.keydown({key:'Enter',target:{matches:()=>true},preventDefault(){prevented=true;}});
  while(!f.calls.length) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(prevented,true); assert.equal(f.calls.length,1);
});
