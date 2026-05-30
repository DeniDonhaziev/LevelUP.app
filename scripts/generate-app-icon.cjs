/**
 * Собирает квадратную иконку 1024×1024: чёрный фон + логотип LEVEL UP по центру с отступами
 * (как у нормальных иконок на рабочем столе). Запуск: npm run generate-app-icon
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets/images/levelup-logo-wide.png');
const OUT = path.join(ROOT, 'assets/images/app-icon.png');

const SIZE = 1024;
/** Доля полей с каждой стороны (как «внутренние поля» в скринкле) */
const PADDING_RATIO = 0.14;

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Нет файла:', SRC);
    process.exit(1);
  }

  const inner = Math.floor(SIZE * (1 - 2 * PADDING_RATIO));
  const resizedBuf = await sharp(SRC)
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  const { width: w, height: h } = await sharp(resizedBuf).metadata();
  const left = Math.floor((SIZE - w) / 2);
  const top = Math.floor((SIZE - h) / 2);

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 1 },
    },
  })
    .composite([{ input: resizedBuf, left, top }])
    .png()
    .toFile(OUT);

  console.log('OK →', path.relative(ROOT, OUT), `(${SIZE}×${SIZE}, логотип ~${w}×${h})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
