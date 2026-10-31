import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportKit } from '../scripts/export-kit.mjs';
import { verifyKit } from '../scripts/verify-kit.mjs';
const example = fileURLToPath(new URL('../examples/tide-and-town/brand.json', import.meta.url));

test('a complete independent brand exports and verifies across platforms', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'logo-icon-kit-'));
  const output = path.join(dir, 'kit');
  await exportKit(example, output);
  const result = await verifyKit(output);
  assert.deepEqual(result.failures, []);
  assert.ok(result.pngCount > 30);
  const gallery = await readFile(path.join(output, 'index.html'), 'utf8');
  assert.ok(!gallery.includes('{{primary}}'));
  const primary = await readFile(path.join(output, 'app-icons/primary/app-icon-512.png'));
  await exportKit(example, output);
  assert.deepEqual(await readFile(path.join(output, 'app-icons/primary/app-icon-512.png')), primary);
});

test('an unrelated output folder remains untouched', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'logo-icon-kit-owned-'));
  await writeFile(path.join(dir, 'keep.txt'), 'user-owned content');
  await assert.rejects(exportKit(example, dir), /not owned/);
  assert.deepEqual(await readdir(dir), ['keep.txt']);
  assert.equal(await readFile(path.join(dir, 'keep.txt'), 'utf8'), 'user-owned content');
});

test('invalid source is rejected before any output is written', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'logo-icon-kit-input-'));
  await writeFile(path.join(dir, 'unsafe.svg'), '<svg viewBox="0 0 100 100"><script>alert(1)</script><path fill="{{primary}}" d="M0 0H10V10Z"/></svg>');
  const config = JSON.parse(await readFile(example, 'utf8'));
  config.mark = 'unsafe.svg';
  delete config.wordmark;
  await writeFile(path.join(dir, 'brand.json'), JSON.stringify(config));
  const output = path.join(dir, 'kit');
  await assert.rejects(exportKit(path.join(dir, 'brand.json'), output), /without scripts/);
  await assert.rejects(readdir(output), { code: 'ENOENT' });
});
