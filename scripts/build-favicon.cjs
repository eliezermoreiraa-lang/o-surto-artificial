// Package the approved TV artwork into standard browser icon formats.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets-min/favicon-tv-source.png');

async function main() {
  for (const [size, name] of [[192, 'favicon-192.png'], [180, 'apple-touch-icon.png']]) {
    await sharp(source).resize(size, size).png().toFile(path.join(root, name));
  }
  const sizes = [16, 32, 48];
  const frames = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach((frame, i) => {
    const entry = 6 + i * 16;
    header[entry] = sizes[i];
    header[entry + 1] = sizes[i];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });
  await fs.writeFile(path.join(root, 'favicon.ico'), Buffer.concat([header, ...frames]));
  console.log('Generated favicon.ico (16/32/48), favicon-192.png and apple-touch-icon.png.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
