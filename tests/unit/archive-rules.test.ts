import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import {
  MAX_UNPACKED_BYTES,
  checkArchiveEntries,
  checkIndexHtml,
} from '../../tools/lib/archive-rules';
import { inspectZip } from '../../tools/lib/zip';

const ok = [
  { path: 'index.html', size: 900 },
  { path: 'assets/', size: 0 },
  { path: 'assets/index-AbC123.js', size: 40_000 },
  { path: 'assets/cormorant-garamond-cyrillic-500-normal.woff2', size: 20_000 },
];

describe('checkArchiveEntries', () => {
  it('принимает корректный набор файлов', () => {
    const report = checkArchiveEntries(ok);
    expect(report.errors).toEqual([]);
    expect(report.fileCount).toBe(3);
    expect(report.totalBytes).toBe(60_900);
  });

  it('требует index.html в корне', () => {
    const report = checkArchiveEntries([{ path: 'dist/index.html', size: 10 }]);
    expect(report.errors.join()).toMatch(/в корне/);
  });

  it('сообщает об отсутствии index.html', () => {
    expect(checkArchiveEntries([{ path: 'a.js', size: 1 }]).errors.join()).toMatch(/нет index\.html/);
  });

  it('запрещает пробелы в именах', () => {
    const report = checkArchiveEntries([...ok, { path: 'assets/my file.png', size: 1 }]);
    expect(report.errors.join()).toMatch(/Пробел/);
  });

  it('запрещает кириллицу в именах файлов и папок', () => {
    const report = checkArchiveEntries([...ok, { path: 'картинки/вода.svg', size: 1 }]);
    expect(report.errors.join()).toMatch(/Кириллица/);
  });

  it('запрещает прочие небезопасные символы', () => {
    const report = checkArchiveEntries([...ok, { path: 'assets/a+b(1).png', size: 1 }]);
    expect(report.errors.join()).toMatch(/Недопустимые символы/);
  });

  it('запрещает выход за пределы архива', () => {
    const report = checkArchiveEntries([...ok, { path: '../secret.txt', size: 1 }]);
    expect(report.errors.join()).toMatch(/Недопустимый путь/);
  });

  it('пропускает ровно 100 МБ и отклоняет больше', () => {
    const atLimit = [{ path: 'index.html', size: MAX_UNPACKED_BYTES }];
    expect(checkArchiveEntries(atLimit).errors).toEqual([]);
    const over = [{ path: 'index.html', size: MAX_UNPACKED_BYTES + 1 }];
    expect(checkArchiveEntries(over).errors.join()).toMatch(/превышает лимит/);
  });

  it('предупреждает о превышении бюджета проекта', () => {
    const report = checkArchiveEntries([{ path: 'index.html', size: 31_000_000 }]);
    expect(report.errors).toEqual([]);
    expect(report.warnings.join()).toMatch(/бюджета/);
  });

  it('находит дубликаты путей, отличающиеся регистром', () => {
    const report = checkArchiveEntries([...ok, { path: 'Index.html', size: 1 }]);
    expect(report.errors.join()).toMatch(/Повторяющийся путь/);
  });
});

describe('checkIndexHtml', () => {
  const html = (body: string): string => `<html><head>${body}</head></html>`;

  it('разрешает /sdk.js и относительные пути', () => {
    const report = checkIndexHtml(
      html('<script src="/sdk.js"></script><script type="module" src="./assets/index.js"></script>'),
      { expectSdk: true },
    );
    expect(report.errors).toEqual([]);
  });

  it('отклоняет абсолютные и внешние пути', () => {
    const report = checkIndexHtml(
      html('<script src="/assets/a.js"></script><link href="https://fonts.example.com/x.css">'),
      { expectSdk: false },
    );
    expect(report.errors).toHaveLength(2);
  });

  it('требует SDK в сборке для Яндекс Игр', () => {
    expect(checkIndexHtml(html(''), { expectSdk: true }).errors.join()).toMatch(/sdk\.js/);
  });
});

describe('inspectZip', () => {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

  it('проверяет настоящий ZIP-архив', () => {
    const archive = zipSync({
      'index.html': encode('<script src="/sdk.js"></script><script src="./assets/a.js"></script>'),
      assets: { 'a.js': encode('console.log(1)') },
    });
    const report = inspectZip(archive, { expectSdk: true });
    expect(report.errors).toEqual([]);
    expect(report.fileCount).toBe(2);
  });

  it('находит ошибки внутри ZIP-архива', () => {
    const archive = zipSync({ game: { 'index.html': encode('<p></p>') }, 'файл 1.txt': encode('x') });
    const report = inspectZip(archive, { expectSdk: true });
    expect(report.errors.join('\n')).toMatch(/в корне/);
    expect(report.errors.join('\n')).toMatch(/Пробел/);
  });
});
