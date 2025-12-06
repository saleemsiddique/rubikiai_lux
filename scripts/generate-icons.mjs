import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const inputImage = join(publicDir, 'rubikiai-logo.png');

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-icon.png' }
];

async function generateIcons() {
  try {
    console.log('Generando iconos PWA...');

    for (const { size, name } of sizes) {
      const outputPath = join(publicDir, name);

      await sharp(inputImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ Generado: ${name} (${size}x${size})`);
    }

    console.log('\n¡Todos los iconos se generaron correctamente!');
  } catch (error) {
    console.error('Error al generar iconos:', error);
    process.exit(1);
  }
}

generateIcons();
