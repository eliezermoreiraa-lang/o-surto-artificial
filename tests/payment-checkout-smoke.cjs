const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const patch = fs.readFileSync(path.join(root, 'surto-payment-patch.js'), 'utf8');
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

console.log('payment checkout smoke: ok');
