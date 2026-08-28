const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const patch = fs.readFileSync(path.join(root, 'surto-payment-patch.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'supporter-dashboard-real-v2.js'), 'utf8');
const mobile = fs.readFileSync(path.join(root, 'mobile-experience-v2.js'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'supporter-dashboard-guard.js'), 'utf8');
const edge = fs.readFileSync(path.join(root, 'supabase', 'functions', 'asaas-create-support-payment', 'index.ts'), 'utf8');

assert.equal(html.includes('<label>Número do cartão</label>'), false);
assert.equal(html.includes('<label>Validade</label>'), false);
assert.equal(html.includes('<label>CVV</label>'), false);
assert.equal(html.includes('Pagamento seguro com cartão'), true);
assert.equal(html.includes('Nenhum dado do cartão é digitado ou armazenado neste site.'), true);
assert.equal(patch.includes("'PAGAR COM CARTÃO NO ASAAS →'"), true);
assert.equal(edge.includes('billingType: isPix ? "PIX" : "CREDIT_CARD"'), true);
assert.equal(edge.includes('if (isCard)'), true);
assert.equal(edge.includes('paymentMethod: "credit_card"'), true);
assert.equal(edge.includes('billingType: method === "pix" ? "PIX" : "UNDEFINED"'), false);
assert.equal(dashboard.includes('data-join-method="pix"'), true);
assert.equal(dashboard.includes('data-join-method="cartao"'), true);
assert.equal(dashboard.includes("method:checkoutMethod"), true);
assert.equal(dashboard.includes('window.location.assign(data.invoiceUrl)'), true);
assert.equal(dashboard.includes('Apoio sem divulgação e sem aparição.'), true);
assert.equal(dashboard.includes('não é participação como personagem'), true);
assert.equal(dashboard.includes("['supporter','highlight','vip'].includes(m.currentSupport.tier)"), true);
assert.equal(dashboard.includes('Esta categoria é anônima e não inclui divulgação, avatar ou aparição.'), true);
assert.equal(mobile.includes('if(isSignedIn){if(hasPaidSupport)openUpgrade();else openJoin()}'), true);
assert.equal(guard.includes('window.__surtoOpenSupportJoin?.()'), true);
assert.equal(patch.includes('window.__surtoOpenSupportJoin && window.__surtoOpenSupportJoin()'), true);
assert.equal(html.includes('Você pode ter seu perfil, trabalho ou marca divulgado nas nossas novelinhas.'), true);

console.log('payment checkout smoke: ok');
