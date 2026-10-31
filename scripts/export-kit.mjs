import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const roles = ['background', 'primary', 'secondary', 'text'];
const platforms = ['web', 'ios', 'android', 'sharing'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const outer = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const rect = (w, h, color) => `<rect width="${w}" height="${h}" fill="${color}"/>`;

function parseSvg(source, label) {
  const cleaned = source.replace(/^\s*<\?xml[^?]*\?>/i, '').trim();
  if (/<(?:script|foreignObject|image|text|style|iframe)\b|<!DOCTYPE|<!ENTITY|\son[a-z]+\s*=|\sstyle\s*=/i.test(cleaned)) throw new Error(`${label}: use outlined SVG paths/shapes, without scripts, live text, images or CSS styling.`);
  if (/\b(?:href|src)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i.test(cleaned)) throw new Error(`${label}: external references are not supported.`);
  const root = cleaned.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/i);
  const match = root?.[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const box = match?.[1].trim().split(/[\s,]+/).map(Number);
  if (!box || box.length !== 4 || box.some(n => !Number.isFinite(n)) || box[2] <= 0 || box[3] <= 0) throw new Error(`${label}: a positive four-number viewBox is required.`);
  return { source: cleaned, attrs: root[1].replace(/\s(?:width|height|x|y|preserveAspectRatio)\s*=\s*["'][^"']*["']/gi, ''), inner: root[2], box };
}

function paint(source, theme, mono) {
  let result = source.replace(/\{\{(primary|secondary|text|background)\}\}/g, (_, role) => mono || theme[role]);
  if (/\{\{[^}]+\}\}/.test(result)) throw new Error('Unknown SVG color token. Use {{primary}}, {{secondary}}, {{text}} or {{background}}.');
  if (mono) result = result.replace(/\b(fill|stroke)\s*=\s*(["'])(?!none\b|transparent\b)([^"']+)\2/gi, (_, attr, quote) => `${attr}=${quote}${mono}${quote}`);
  return result;
}

function nested(source, x, y, w, h) {
  const s = parseSvg(source, 'SVG');
  return `<svg${s.attrs} x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">${s.inner}</svg>`;
}

function validateConfig(c) {
  if (typeof c.name !== 'string' || !c.name.trim()) throw new Error('A nonempty brand name is required.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug || '')) throw new Error('slug must contain lowercase words separated by hyphens.');
  if (typeof c.mark !== 'string' || !c.mark) throw new Error('mark must name an SVG file.');
  if (!c.themes || typeof c.themes !== 'object' || Array.isArray(c.themes) || !Object.keys(c.themes).length) throw new Error('At least one theme is required.');
  for (const [name, palette] of Object.entries(c.themes)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Theme names must be lowercase words/hyphens.');
    for (const role of roles) if (!/^#[0-9a-f]{6}$/i.test(palette?.[role] || '')) throw new Error(`${name}.${role} must be a six-digit hex color.`);
  }
  if (!Object.hasOwn(c.themes, c.primaryTheme)) throw new Error('primaryTheme must name one of the supplied themes.');
  c.platforms ??= [...platforms];
  if (!Array.isArray(c.platforms) || c.platforms.some(p => !platforms.includes(p)) || new Set(c.platforms).size !== c.platforms.length) throw new Error('platforms must be a unique subset of web, ios, android, sharing.');
  c.iconScale ??= .72;
  if (!Number.isFinite(c.iconScale) || c.iconScale < .4 || c.iconScale > .88) throw new Error('iconScale must be between 0.4 and 0.88.');
}

async function alphaRadius(svg) {
  const { data, info } = await sharp(Buffer.from(svg)).resize(216, 216).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let radius = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 127) radius = Math.max(radius, Math.hypot((x + .5) / 2 - 54, (y + .5) / 2 - 54));
  if (!radius) throw new Error('The symbol rendered empty; check its geometry and colors.');
  return radius;
}

export async function exportKit(configFile, outputFolder) {
  const configPath = path.resolve(configFile);
  const out = path.resolve(outputFolder);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  validateConfig(config);
  const mark = parseSvg(await readFile(path.resolve(path.dirname(configPath), config.mark), 'utf8'), 'Mark');
  if (!mark.source.includes('{{primary}}')) throw new Error('Mark must use a {{primary}} color token.');
  const word = config.wordmark ? parseSvg(await readFile(path.resolve(path.dirname(configPath), config.wordmark), 'utf8'), 'Wordmark') : null;
  for (const theme of Object.values(config.themes)) paint(mark.source, theme);
  // Refuse an unrelated nonempty target. Never recursively delete output.
  let names = [];
  try { names = await readdir(out); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (names.length) {
    let owner;
    try { owner = await readFile(path.join(out, '.logo-icon-kit-output'), 'utf8'); } catch { throw new Error('Output is nonempty and is not owned by logo-icon-kit. Choose a new folder.'); }
    if (owner.trim() !== config.slug) throw new Error('Output belongs to a different brand. Choose a new folder.');
  }
  const files = [];
  async function save(name, content, metadata = {}) {
    const target = path.join(out, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    files.push({ path: name, ...metadata });
  }
  async function png(name, svg, size, height = size, opaque = false) {
    let image = sharp(Buffer.from(svg)).resize(size, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    if (opaque) image = image.removeAlpha();
    await save(name, await image.png().toBuffer(), { width: size, height, alpha: opaque ? 'none' : 'allowed' });
  }
  await save('.logo-icon-kit-output', `${config.slug}\n`);
  await save('source/mark-template.svg', mark.source);
  if (word) await save('source/wordmark-outlined.svg', word.source);
  const symbol = (theme, mono) => paint(mark.source, theme, mono);
  const wordmark = theme => paint(word.source, theme, theme.text);
  const appIcon = (theme, scale = config.iconScale) => outer(1024, 1024, rect(1024, 1024, theme.background) + nested(symbol(theme), 512 * (1 - scale), 512 * (1 - scale), 1024 * scale, 1024 * scale));
  const lockup = theme => outer(1600, 320, nested(symbol(theme), 20, 20, 280, 280) + nested(wordmark(theme), 345, 65, 1225, 190));
  const stacked = theme => outer(1000, 1000, nested(symbol(theme), 210, 50, 580, 580) + nested(wordmark(theme), 60, 690, 880, 200));
  const primary = config.themes[config.primaryTheme];
  for (const [name, theme] of Object.entries(config.themes)) {
    await save(`logos/mark-${name}.svg`, symbol(theme));
    for (const size of [256, 512, 1024]) await png(`logos/png/mark-${name}-${size}.png`, symbol(theme), size);
    if (word) {
      await save(`logos/wordmark-${name}.svg`, wordmark(theme));
      await save(`logos/logo-horizontal-${name}.svg`, lockup(theme));
      await save(`logos/logo-stacked-${name}.svg`, stacked(theme));
      await png(`logos/png/logo-horizontal-${name}-1600.png`, lockup(theme), 1600, 320);
      await png(`logos/png/logo-stacked-${name}-1000.png`, stacked(theme), 1000);
    }
    const folder = name === config.primaryTheme ? 'app-icons/primary' : `app-icons/alternates/${name}`;
    await save(`${folder}/app-icon.svg`, appIcon(theme));
    for (const size of [192, 512, 1024]) await png(`${folder}/app-icon-${size}.png`, appIcon(theme), size);
  }
  for (const [name, color] of [['black', '#000000'], ['white', '#FFFFFF']]) {
    await save(`logos/mark-mono-${name}.svg`, symbol(primary, color));
    await png(`logos/png/mark-mono-${name}-1024.png`, symbol(primary, color), 1024);
    if (word) await save(`logos/logo-horizontal-mono-${name}.svg`, lockup({ ...primary, primary: color, secondary: color, text: color }));
  }
  if (config.platforms.includes('web')) {
    await save('web/favicon.svg', appIcon(primary, .84));
    const buffers = [];
    for (const size of [16, 32, 48]) {
      await png(`web/favicon-${size}.png`, appIcon(primary, .84), size);
      buffers.push(await readFile(path.join(out, `web/favicon-${size}.png`)));
    }
    const header = Buffer.alloc(6 + 16 * buffers.length);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(buffers.length, 4);
    let offset = header.length;
    buffers.forEach((buffer, i) => { const p = 6 + i * 16; header[p] = [16, 32, 48][i]; header[p + 1] = header[p]; header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6); header.writeUInt32LE(buffer.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += buffer.length; });
    await save('web/favicon.ico', Buffer.concat([header, ...buffers]));
    await png('web/apple-touch-icon.png', appIcon(primary), 180, 180, true);
    for (const size of [192, 512]) await png(`web/icon-${size}.png`, appIcon(primary), size);
    await png('web/icon-maskable-512.png', appIcon(primary, .54), 512);
    await save('web/manifest.example.webmanifest', JSON.stringify({ name: config.name, short_name: config.name, start_url: '/', display: 'standalone', theme_color: primary.background, background_color: primary.background, icons: [192, 512].map(s => ({ src: `icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' })).concat({ src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }) }, null, 2));
  }
  if (config.platforms.includes('ios')) {
    const images = [];
    for (const [idiom, entries] of [['iphone', [[20, 2], [20, 3], [29, 2], [29, 3], [40, 2], [40, 3], [60, 2], [60, 3]]], ['ipad', [[20, 1], [20, 2], [29, 1], [29, 2], [40, 1], [40, 2], [76, 1], [76, 2], [83.5, 2]]]]) {
      for (const [points, scale] of entries) {
        const filename = `${idiom}-${points}@${scale}x.png`;
        await png(`ios/AppIcon.appiconset/${filename}`, appIcon(primary), points * scale, points * scale, true);
        images.push({ idiom, size: `${points}x${points}`, scale: `${scale}x`, filename });
      }
    }
    await png('ios/AppIcon.appiconset/app-store-1024.png', appIcon(primary), 1024, 1024, true);
    images.push({ idiom: 'ios-marketing', size: '1024x1024', scale: '1x', filename: 'app-store-1024.png' });
    await save('ios/AppIcon.appiconset/Contents.json', JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2));
    await png('ios/icon-composer-layers/background-1024.png', outer(1024, 1024, rect(1024, 1024, primary.background)), 1024, 1024, true);
    await png('ios/icon-composer-layers/foreground-1024.png', outer(1024, 1024, nested(symbol(primary), 512 * (1 - config.iconScale), 512 * (1 - config.iconScale), 1024 * config.iconScale, 1024 * config.iconScale)), 1024);
  }
  let adaptiveRadiusDp;
  if (config.platforms.includes('android')) {
    let size = 60;
    const adaptive = (mono = false) => outer(108, 108, nested(symbol(primary, mono ? '#000000' : undefined), (108 - size) / 2, (108 - size) / 2, size, size));
    const initial = await alphaRadius(adaptive(true));
    size *= Math.min(1, 31.5 / initial);
    adaptiveRadiusDp = Number((await alphaRadius(adaptive(true))).toFixed(2));
    await save('android/layers/foreground.svg', adaptive());
    await save('android/layers/monochrome.svg', adaptive(true));
    await save('android/layers/background.svg', outer(108, 108, rect(108, 108, primary.background)));
    for (const [density, factor] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
      await png(`android/res/mipmap-${density}/ic_launcher.png`, appIcon(primary), 48 * factor);
      await png(`android/res/drawable-${density}/ic_launcher_foreground.png`, adaptive(), 108 * factor);
      await png(`android/res/drawable-${density}/ic_launcher_monochrome.png`, adaptive(true), 108 * factor);
    }
    await save('android/res/drawable/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?><shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="${primary.background}"/></shape>`);
    for (const version of [26, 33]) await save(`android/res/mipmap-anydpi-v${version}/ic_launcher.xml`, `<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@drawable/ic_launcher_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/>${version === 33 ? '<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>' : ''}</adaptive-icon>`);
    await png('android/google-play-512.png', appIcon(primary), 512);
    await save('android/AndroidManifest.example.xml', '<!-- Fragment for the eventual application element, not a complete manifest. -->\n<application xmlns:android="http://schemas.android.com/apk/res/android" android:icon="@mipmap/ic_launcher"/>');
  }
  if (config.platforms.includes('sharing')) {
    for (const [name, theme] of Object.entries(config.themes)) {
      const art = rect(1200, 630, theme.background) + nested(symbol(theme), word ? 410 : 360, word ? 45 : 75, word ? 380 : 480, word ? 380 : 480) + (word ? nested(wordmark(theme), 100, 440, 1000, 130) : '');
      await save(`sharing/card-${name}-1200x630.svg`, outer(1200, 630, art));
      await png(`sharing/card-${name}-1200x630.png`, outer(1200, 630, art), 1200, 630);
    }
    await png('sharing/avatar-1080.png', appIcon(primary), 1080);
    await png('sharing/brand-square-1080.png', word ? outer(1000, 1000, rect(1000, 1000, primary.background) + nested(stacked(primary), 0, 0, 1000, 1000)) : appIcon(primary), 1080);
  }
  await save('USAGE.md', `# ${config.name} — icon kit\n\nPrimary external identity: **${config.primaryTheme}**. Launcher, favicon, store and default sharing assets use this appearance. Alternate exports are not automatically registered with any OS. In-product logos can follow product themes using the same geometry.\n\n${word ? 'SVG wordmarks are outlined.' : 'Symbol-only kit: no wordmark source was supplied.'} Transparent logo PNGs are separate from opaque app/store masters. Icon masks in the gallery are previews; exported store masters are full squares.\n\nNative resources are prepared files, not installed/tested native apps. iOS Icon Composer layers are not a compiled .icon package. The web manifest and Android manifest fragment are examples, not enabled applications. Inspect actual devices and current platform requirements during integration.\n\nPreserve silhouette/proportions, use suitable contrast and clear space, and do not stretch the mark. Retain selected concept references, prompts and source/font license notices alongside this kit where appropriate.\n`);
  const panels = Object.entries(config.themes).map(([name, theme]) => `<section style="background:${theme.background};color:${theme.text}"><small>${esc(name)} appearance</small><img class="logo" src="logos/${word ? 'logo-horizontal' : 'mark'}-${name}.svg" alt="${esc(config.name)} ${esc(name)} logo"><div class="samples"><figure><img class="tile" src="app-icons/primary/app-icon-192.png" alt="Primary icon"><figcaption>Fixed primary icon</figcaption></figure><figure><img class="mark" src="logos/mark-${name}.svg" alt="Theme symbol"><figcaption>In-product mark</figcaption></figure></div>${config.platforms.includes('web') ? `<div class="tiny">${[16, 24, 32].map(s => `<img src="web/favicon-${s === 24 ? 32 : s}.png" width="${s}" height="${s}" alt="${s}px primary icon">`).join('')}<small>16 / 24 / 32px study</small></div>` : ''}</section>`).join('');
  await save('index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(config.name)} — brand kit</title><style>*{box-sizing:border-box}body{margin:0;background:#eae9e4;color:#232428;font:16px/1.6 system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:40px 28px}h1{font-size:40px;letter-spacing:-1.5px;margin:5px 0 10px}header p{max-width:720px}.panels{display:grid;grid-template-columns:repeat(${Math.min(2, Object.keys(config.themes).length)},minmax(0,1fr));margin:32px 0 22px}section{padding:28px 30px}.logo{width:100%;height:150px;object-fit:contain;margin:24px 0}.samples{display:flex;justify-content:space-around;gap:24px}figure{margin:0;text-align:center}.tile,.mark{width:100px;height:100px;object-fit:contain}.tile{border-radius:23%}figcaption{font-size:12px;margin-top:12px}.tiny{display:flex;gap:14px;align-items:center;justify-content:center;margin:30px 0 10px}.tiny small{margin-left:8px}small{font-size:12px}a{color:inherit;text-underline-offset:4px}.downloads{display:flex;gap:24px;flex-wrap:wrap;padding:22px;background:#fffdf8}.mono{display:flex;align-items:center;gap:30px;padding:24px;margin-top:22px;background:#c9c9c4}.mono img{width:65px;height:65px}.note{font-size:13px;max-width:850px}footer{margin-top:28px;font-size:12px}@media(max-width:700px){main{padding:25px 16px}h1{font-size:32px}.panels{grid-template-columns:1fr}section{padding:24px 20px}.logo{height:120px}.tiny{flex-wrap:wrap}}</style></head><body><main><header><small>LOGO & ICON KIT / EXPORTED IDENTITY</small><h1>${esc(config.name)}</h1><p>One recognizable symbol, coordinated appearances, and a fixed primary icon. These are prepared assets for product integration.</p></header><div class="panels">${panels}</div><div class="downloads"><a href="app-icons/primary/app-icon-1024.png" download>Primary 1024px icon ↓</a><a href="logos/mark-${config.primaryTheme}.svg" download>SVG mark ↓</a>${word ? `<a href="logos/logo-horizontal-${config.primaryTheme}.svg" download>SVG logo ↓</a>` : ''}<a href="manifest.json">File manifest</a><a href="USAGE.md">Usage notes</a></div><div class="mono"><img src="logos/mark-mono-black.svg" alt="Black mark"><img src="logos/mark-mono-white.svg" alt="White mark"><span>Single-color versions for print and system tinting.</span></div><p class="note">Native launcher resources still need integration and device checks. Small-size samples are previews; inspect the actual target. Optional appearance exports are separate from an in-app theme toggle.</p><footer>Generated locally with Logo & Icon Kit. No source app files were changed.</footer></main></body></html>`);
  const manifest = { generator: 'logo-icon-kit', version: 1, name: config.name, slug: config.slug, primaryTheme: config.primaryTheme, themeNames: Object.keys(config.themes), platforms: config.platforms, hasWordmark: !!word, sourceSha256: createHash('sha256').update(mark.source).digest('hex'), adaptiveRadiusDp, files };
  await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { output: out, files: files.length + 1, primaryTheme: config.primaryTheme, adaptiveRadiusDp };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) console.log('node scripts/export-kit.mjs --config brand.json --out /path/to/new-kit');
  else {
    try {
      if (args.length !== 4 || args[0] !== '--config' || args[2] !== '--out') throw new Error('Usage: node scripts/export-kit.mjs --config brand.json --out /path/to/new-kit');
      console.log(JSON.stringify(await exportKit(args[1], args[3]), null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
