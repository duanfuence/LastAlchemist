/**
 * Проверка произвольного ZIP-архива на соответствие требованиям Яндекс Игр.
 * Использование: npm run verify:zip -- путь/к/архиву.zip [--no-sdk]
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { printReport } from './lib/report';
import { inspectZip } from './lib/zip';

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));

if (!file) {
  console.error('Укажите путь к архиву: npm run verify:zip -- release/last-alchemist-v0.1.0.zip');
  process.exitCode = 1;
} else {
  const path = resolve(file);
  try {
    const archive = new Uint8Array(await readFile(path));
    const report = inspectZip(archive, { expectSdk: !args.includes('--no-sdk') });
    process.exitCode = printReport(`Проверка архива ${path}`, report, archive.byteLength) ? 0 : 1;
  } catch (error) {
    console.error(`Не удалось прочитать архив ${path}:`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
