import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '../../frontend-UI/node_modules/sharp/lib/index.js';

const root = path.resolve('docs/brand');
const mark = await fs.readFile(path.join(root, 'mark.svg'));
const markWhite = await fs.readFile(path.join(root, 'mark-white.svg'));

async function renderMark(size) {
  return sharp(mark, { density: size * 100 / 100 }).resize(size, size).png().toBuffer();
}

async function alphaBounds(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] !== 0) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const bounds = {};
for (const size of [192, 180, 24]) {
  const output = await renderMark(size);
  await fs.writeFile(path.join(root, `icon-${size}.png`), output);
  bounds[`icon-${size}.png`] = await alphaBounds(output);
}

// Maskable icon: render the source mark at 380px then center it on a transparent 512px canvas.
// Its alpha bounds fit inside the required centered 410px-diameter circle.
const mark380 = await renderMark(380);
const icon512 = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: mark380, left: 66, top: 66 }]).png().toBuffer();
await fs.writeFile(path.join(root, 'icon-512.png'), icon512);
bounds['icon-512.png'] = await alphaBounds(icon512);
const icon512White = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(markWhite).resize(380, 380).png().toBuffer(), left: 66, top: 66 }]).png().toBuffer();

const panelW = 900;
const rowH = 620;
const panels = [
  { y: 0, background: '#F8F7F5', labelColor: '#0F1729', mark: icon512 },
  { y: rowH, background: '#0E121A', labelColor: '#FFFFFF', mark: icon512White },
];
const contact = sharp({ create: { width: panelW, height: rowH * 2, channels: 4, background: '#F8F7F5' } });
const layers = [];
for (const panel of panels) {
  layers.push({ input: Buffer.from(`<svg width="${panelW}" height="${rowH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${panel.background}"/><text x="48" y="62" font-family="Space Grotesk, sans-serif" font-size="24" font-weight="600" fill="${panel.labelColor}">${panel.background === '#F8F7F5' ? 'Light mode / Paper' : 'Dark mode / Night'}</text><text x="48" y="100" font-family="Space Grotesk, sans-serif" font-size="16" font-weight="600" fill="${panel.labelColor}">512 px</text><text x="638" y="100" font-family="Space Grotesk, sans-serif" font-size="16" font-weight="600" fill="${panel.labelColor}">64 px</text><text x="786" y="100" font-family="Space Grotesk, sans-serif" font-size="16" font-weight="600" fill="${panel.labelColor}">24 px</text></svg>`), left: 0, top: panel.y });
  layers.push({ input: panel.mark, left: 48, top: panel.y + 104 });
  layers.push({ input: await sharp(panel.mark).resize(64, 64).png().toBuffer(), left: 638, top: panel.y + 128 });
  layers.push({ input: await sharp(panel.mark).resize(24, 24).png().toBuffer(), left: 786, top: panel.y + 148 });
}
await contact.composite(layers).png().toFile(path.join(root, 'contact-sheet.png'));

console.log(JSON.stringify(bounds, null, 2));
