import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '../../frontend-UI/node_modules/sharp/lib/index.js';

const root = path.resolve('docs/brand');
async function rasterize(svgName, pngName, options) {
  const input = await fs.readFile(path.join(root, svgName));
  await sharp(input).resize(options).png().toFile(path.join(root, pngName));
}

await rasterize('wordmark.svg', 'wordmark.png', { width: 1200 });
await rasterize('wordmark-dark.svg', 'wordmark-dark.png', { width: 1200 });
await rasterize('wordmark.svg', 'wordmark-28.png', { height: 28 });

for (const name of ['wordmark.png', 'wordmark-dark.png', 'wordmark-28.png']) {
  const meta = await sharp(path.join(root, name)).metadata();
  console.log(`${name}: ${meta.width}x${meta.height}, alpha=${meta.hasAlpha}`);
}
