import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assembleContent, type AssembleResult } from '../../src/core/content/assemble';
import type { ValidationOptions } from '../../src/core/content/validate';

export const ROOT = resolve(import.meta.dirname, '..', '..');

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

function readDir(dir: string): Record<string, unknown> {
  const full = join(ROOT, dir);
  return Object.fromEntries(
    readdirSync(full)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => [`${dir}/${name}`, readJson(join(full, name))]),
  );
}

/** Читает базу контента с диска (для проверки базы и unit-тестов). */
export function readContentFromDisk(): { assembled: AssembleResult; options: ValidationOptions } {
  const assembled = assembleContent({
    elements: readDir('content/elements'),
    recipes: readDir('content/recipes'),
    categories: readJson(join(ROOT, 'content/categories.json')),
  });
  const locales = readdirSync(join(ROOT, 'content/locales'));
  const options: ValidationOptions = {
    assembleIssues: assembled.issues,
    elementTexts: Object.fromEntries(
      locales.map((locale) => [locale, readJson(join(ROOT, 'content/locales', locale, 'elements.json'))]),
    ) as NonNullable<ValidationOptions['elementTexts']>,
    categoryTexts: Object.fromEntries(
      locales.map((locale) => [locale, readJson(join(ROOT, 'content/locales', locale, 'categories.json'))]),
    ) as NonNullable<ValidationOptions['categoryTexts']>,
    artExists: (path) => existsSync(join(ROOT, 'assets', path)),
  };
  return { assembled, options };
}
