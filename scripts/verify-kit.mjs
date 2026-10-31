import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export async function verifyKit(folder) {
  const out = path.resolve(folder);
  const m = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
  if (m.generator !== 'logo-icon-kit' || !Array.isArray(m.files)) throw new Error('Not a logo-icon-kit manifest.');
  const failures = [];
  let pngCount = 0;
  for (const item of m.files) {
    const target = path.resolve(out, item.path);
    if (!target.startsWith(out + path.sep)) throw new Error('Manifest contains an out-of-folder path.');
    try {
      if (!(await stat(target)).size) failures.push(`${item.path}: empty file`);
      if (item.path.endsWith('.png')) {
        pngCount++;
        const image = sharp(target);
        const metadata = await image.metadata();
        if (metadata.width !== item.width || metadata.height !== item.height) failures.push(`${item.path}: incorrect dimensions`);
        if (item.alpha === 'none' && metadata.hasAlpha) failures.push(`${item.path}: unexpected alpha channel`);
        if (item.path.startsWith('app-icons/') || item.path.includes('AppIcon.appiconset/') || item.path === 'android/google-play-512.png') {
          if (metadata.hasAlpha) {
            const stats = await image.stats();
            if (stats.channels[metadata.channels - 1].min !== 255) failures.push(`${item.path}: app/store icon is not opaque`);
          }
        }
        if (item.path.startsWith('logos/png/')) {
          const stats = await image.stats();
          const alpha = metadata.hasAlpha ? stats.channels[metadata.channels - 1] : null;
          if (!alpha || alpha.min !== 0 || alpha.max !== 255) failures.push(`${item.path}: expected transparent background and visible art`);
        }
      }
    } catch (error) { failures.push(`${item.path}: ${error.message}`); }
  }
  if (m.platforms.includes('ios')) {
    const catalog = JSON.parse(await readFile(path.join(out, 'ios/AppIcon.appiconset/Contents.json'), 'utf8'));
    for (const entry of catalog.images) {
      const metadata = await sharp(path.join(out, 'ios/AppIcon.appiconset', entry.filename)).metadata();
      const size = parseFloat(entry.size) * parseFloat(entry.scale);
      if (metadata.width !== size || metadata.height !== size || metadata.hasAlpha) failures.push(`iOS catalog entry ${entry.filename}: size/alpha mismatch`);
    }
  }
  if (m.platforms.includes('android')) {
    const { data, info } = await sharp(path.join(out, 'android/layers/monochrome.svg')).resize(216, 216).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let radius = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 127) radius = Math.max(radius, Math.hypot((x + .5) / 2 - 54, (y + .5) / 2 - 54));
    if (radius > 33 || !radius) failures.push(`Android essential artwork radius is ${radius.toFixed(2)}dp`);
  }
  if (m.platforms.includes('web')) {
    const ico = await readFile(path.join(out, 'web/favicon.ico'));
    if (ico.readUInt16LE(2) !== 1 || ico.readUInt16LE(4) !== 3) failures.push('ICO header is invalid');
    for (let i = 0; i < 3; i++) {
      const n = 6 + i * 16;
      const start = ico.readUInt32LE(n + 12);
      const length = ico.readUInt32LE(n + 8);
      const image = await sharp(ico.subarray(start, start + length)).metadata();
      if (image.width !== [16, 32, 48][i] || image.height !== image.width) failures.push('ICO embedded image has incorrect dimensions');
    }
  }
  const result = { name: m.name, filesChecked: m.files.length, pngCount, failures };
  if (failures.length) throw new Error(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/verify-kit.mjs /path/to/brand-kit');
    console.log(JSON.stringify(await verifyKit(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
