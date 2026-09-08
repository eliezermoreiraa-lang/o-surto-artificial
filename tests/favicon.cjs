const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');

async function main() {
  for (const file of ['index.html', 'admin.html', 'privacidade.html', 'termos.html']) {
    const html = await fs.readFile(path.join(root, file), 'utf8');
    const head = html.split('</head>')[0];
    assert.match(head, /<title>[^<]+<\/title>/);
    for (const name of ['favicon.ico', 'favicon-192.png', 'apple-touch-icon.png']) {
      assert.ok(head.includes(`href="/${name}?v=20260908-1"`), `${file}: ${name}`);
    }
  }
  for (const [name, size] of [['favicon-192.png', 192], ['apple-touch-icon.png', 180]]) {
    const meta = await sharp(path.join(root, name)).metadata();
    assert.equal(meta.width, size);
    assert.equal(meta.height, size);
    assert.equal(meta.format, 'png');
  }
  const ico = await fs.readFile(path.join(root, 'favicon.ico'));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [i, size] of [16, 32, 48].entries()) {
    const entry = 6 + i * 16;
    const bytes = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const meta = await sharp(ico.subarray(offset, offset + bytes)).metadata();
    assert.equal(meta.width, size);
    assert.equal(meta.height, size);
  }
  console.log('PASS: all pages declare icons; PNG and all ICO frames decode at expected sizes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
