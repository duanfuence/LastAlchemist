import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { checkArchiveEntries, checkIndexHtml, type ArchiveReport } from './archive-rules';

/** Все файлы каталога рекурсивно, пути через "/" относительно корня. */
export async function listFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) result.push(relative(root, full).split(sep).join('/'));
    }
  }
  await walk(root);
  return result.sort();
}

/** Собирает ZIP из каталога. Фиксированная дата делает архив воспроизводимым. */
export async function zipDirectory(root: string): Promise<Uint8Array> {
  const files: Zippable = {};
  const mtime = new Date('2026-01-01T00:00:00Z');
  for (const path of await listFiles(root)) {
    const data = await readFile(join(root, path));
    files[path] = [new Uint8Array(data), { level: 9, mtime }];
  }
  return zipSync(files);
}

export function inspectZip(archive: Uint8Array, { expectSdk }: { expectSdk: boolean }): ArchiveReport {
  const unpacked = unzipSync(archive);
  const entries = Object.entries(unpacked).map(([path, data]) => ({ path, size: data.byteLength }));
  const report = checkArchiveEntries(entries);
  const index = unpacked['index.html'];
  if (index) {
    const html = checkIndexHtml(new TextDecoder().decode(index), { expectSdk });
    report.errors.push(...html.errors);
    report.warnings.push(...html.warnings);
  }
  return report;
}
