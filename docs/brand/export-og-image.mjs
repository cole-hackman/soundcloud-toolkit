import sharp from '../../frontend-UI/node_modules/sharp/lib/index.js';

await sharp('docs/brand/og-image-render.svg').resize(1200, 630).png().toFile('docs/brand/og-image.png');
