import { recipeKey } from '../alchemy/keys';
import type {
  CategoryDef,
  ContentPack,
  ElementDef,
  RawContentFiles,
  RawElement,
  RawRecipe,
  RecipeDef,
} from './types';

export interface ContentIssue {
  level: 'error' | 'warning';
  message: string;
}

export interface AssembleResult {
  pack: ContentPack;
  issues: ContentIssue[];
}

export const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

const asBool = (value: unknown): boolean => value === true;

/**
 * Собирает пакет контента из сырых JSON-файлов и сообщает об ошибках формата.
 * Дубликаты и ссылки здесь не проверяются — это задача validateContent.
 * Повторяющиеся элементы попадают в пакет один раз (первое определение), остальное — в issues.
 */
export function assembleContent(files: RawContentFiles): AssembleResult {
  const issues: ContentIssue[] = [];
  const error = (message: string): void => {
    issues.push({ level: 'error', message });
  };

  const elements = new Map<string, ElementDef>();
  for (const [source, list] of Object.entries(files.elements).sort(([a], [b]) => a.localeCompare(b))) {
    if (!Array.isArray(list)) {
      error(`${source}: ожидается массив элементов`);
      continue;
    }
    list.forEach((raw: RawElement, index) => {
      const where = `${source}[${index}]`;
      if (typeof raw !== 'object' || raw === null) return error(`${where}: элемент должен быть объектом`);
      if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
        return error(`${where}: некорректный id ${JSON.stringify(raw.id)} (латиница в нижнем регистре, цифры, «_»)`);
      }
      if (typeof raw.category !== 'string' || raw.category === '') return error(`${where} "${raw.id}": нет категории`);
      if (typeof raw.art !== 'string' || !/^[\w/-]+\.(svg|webp)$/.test(raw.art)) {
        return error(`${where} "${raw.id}": некорректный путь к иллюстрации ${JSON.stringify(raw.art)}`);
      }
      if (elements.has(raw.id)) return error(`Дубликат элемента "${raw.id}" (${where})`);
      elements.set(raw.id, {
        id: raw.id,
        category: raw.category,
        art: raw.art,
        starting: asBool(raw.starting),
        secret: asBool(raw.secret),
        final: asBool(raw.final),
      });
    });
  }

  const recipes: RecipeDef[] = [];
  for (const [source, list] of Object.entries(files.recipes).sort(([a], [b]) => a.localeCompare(b))) {
    if (!Array.isArray(list)) {
      error(`${source}: ожидается массив рецептов`);
      continue;
    }
    list.forEach((raw: RawRecipe, index) => {
      const where = `${source}[${index}]`;
      if (typeof raw !== 'object' || raw === null) return error(`${where}: рецепт должен быть объектом`);
      const inputs = raw.in;
      if (!Array.isArray(inputs) || inputs.length !== 2 || !inputs.every((id) => typeof id === 'string')) {
        return error(`${where}: "in" должен содержать ровно два ID элементов`);
      }
      if (typeof raw.out !== 'string') return error(`${where}: "out" должен быть ID элемента`);
      const pair: [string, string] = [inputs[0] as string, inputs[1] as string];
      const ordered = asBool(raw.ordered);
      recipes.push({ key: recipeKey(pair, ordered), inputs: pair, output: raw.out, ordered, source: where });
    });
  }

  const categories: CategoryDef[] = [];
  if (!Array.isArray(files.categories)) {
    error('categories.json: ожидается массив категорий');
  } else {
    for (const raw of files.categories as { id?: unknown; order?: unknown }[]) {
      if (typeof raw?.id !== 'string' || typeof raw.order !== 'number') {
        error(`categories.json: некорректная категория ${JSON.stringify(raw)}`);
        continue;
      }
      categories.push({ id: raw.id, order: raw.order });
    }
    categories.sort((a, b) => a.order - b.order);
  }

  const startingIds = [...elements.values()].filter((e) => e.starting).map((e) => e.id);
  return { pack: { elements, recipes, categories, startingIds }, issues };
}
