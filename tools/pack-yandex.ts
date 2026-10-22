/**
 * Упаковка сборки для консоли Яндекс Игр.
 * Ожидает готовый каталог dist/ (npm run build), создаёт release/last-alchemist-v<версия>.zip
 * и проверяет уже созданный архив, а не только исходный каталог.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkArchiveEntries } from './lib/archive-rules';
import { printReport } from './lib/report';
import { inspectZip, listFiles, zipDirectory } from './lib/zip';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');
const RELEASE = resolve(ROOT, 'release');

async function main(): Promise<number> {
  if (!existsSync(DIST)) {
    console.error('Каталог dist/ не найден. Сначала выполните npm run build.');
    return 1;
  }

  const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8')) as { version: string };
  const files = await listFiles(DIST);
  const sizes = await Promise.all(
    files.map(async (path) => ({ path, size: (await readFile(resolve(DIST, path))).byteLength })),
  );
  // Ранняя проверка каталога: не создаём заведомо негодный архив
  if (!printReport('Проверка каталога dist/', checkArchiveEntries(sizes))) return 1;

  const archive = await zipDirectory(DIST);
  await mkdir(RELEASE, { recursive: true });
  const target = resolve(RELEASE, `last-alchemist-v${pkg.version}.zip`);
  await writeFile(target, archive);

  const ok = printReport(`Проверка архива ${target}`, inspectZip(archive, { expectSdk: true }), archive.byteLength);
  return ok ? 0 : 1;
}

process.exitCode = await main();
