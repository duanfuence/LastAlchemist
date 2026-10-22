import categories from '../../content/categories.json';
import { assembleContent, type AssembleResult } from '../core/content/assemble';

/**
 * База рецептов игры. Файлы content/elements/*.json и content/recipes/*.json
 * собираются при сборке; добавление элемента или рецепта не требует изменения кода.
 */
const elementFiles = import.meta.glob<unknown>('../../content/elements/*.json', { eager: true, import: 'default' });
const recipeFiles = import.meta.glob<unknown>('../../content/recipes/*.json', { eager: true, import: 'default' });

const normalize = (files: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(files).map(([path, data]) => [path.replace(/^(\.\.\/)+/, ''), data]));

export function loadContent(): AssembleResult {
  return assembleContent({
    elements: normalize(elementFiles),
    recipes: normalize(recipeFiles),
    categories,
  });
}
