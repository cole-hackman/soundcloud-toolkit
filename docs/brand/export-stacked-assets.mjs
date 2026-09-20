import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '../../frontend-UI/node_modules/sharp/lib/index.js';

const root = path.resolve('docs/brand');
for (const [source, target] of [
  ['wordmark-stacked.svg', 'wordmark-stacked.png'],
  ['wordmark-stacked-dark.svg', 'wordmark-stacked-dark.png'],
]) {
  const svg = await fs.readFile(path.join(root, source));
  await sharp(svg).resize({ width: 1024 }).png().toFile(path.join(root, target));
}
