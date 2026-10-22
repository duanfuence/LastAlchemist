import { unorderedKey } from '../alchemy/keys';
import type { ContentIssue } from './assemble';
import type { ContentPack } from './types';

export interface ElementTexts {
  [id: string]: { name?: unknown; description?: unknown } | undefined;
}

export interface ValidationOptions {
  /** Ошибки формата, найденные при сборке пакета (assembleContent). */
  assembleIssues?: readonly ContentIssue[];
  /** Тексты элементов по языкам: язык → id → { name, description }. */
  elementTexts?: Record<string, ElementTexts>;
  /** Названия категорий по языкам. */
  categoryTexts?: Record<string, Record<string, unknown>>;
  /** Проверка наличия файла иллюстрации (путь относительно assets/). */
  artExists?: (path: string) => boolean;
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  stats: {
    elements: number;
    recipes: number;
    starting: number;
    secret: number;
    /** Минимальное число соединений от начальных элементов. */
    depth: ReadonlyMap<string, number>;
  };
}

/**
 * Достижимость: начинаем с начальных элементов и повторяем рецепты, у которых оба входа
 * уже достижимы, пока множество растёт. Элементы, получаемые только друг из друга
 * (замкнутый цикл без начального пути), в него никогда не попадут.
 */
export function computeDepths(pack: ContentPack): Map<string, number> {
  const depth = new Map<string, number>();
  for (const id of pack.startingIds) depth.set(id, 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const recipe of pack.recipes) {
      const [a, b] = recipe.inputs;
      const da = depth.get(a);
      const db = depth.get(b);
      if (da === undefined || db === undefined || !pack.elements.has(recipe.output)) continue;
      const candidate = Math.max(da, db) + 1;
      const current = depth.get(recipe.output);
      if (current === undefined || candidate < current) {
        depth.set(recipe.output, candidate);
        changed = true;
      }
    }
  }
  return depth;
}

export function validateContent(pack: ContentPack, options: ValidationOptions = {}): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const issue of options.assembleIssues ?? []) {
    (issue.level === 'error' ? errors : warnings).push(issue.message);
  }

  const { elements, recipes } = pack;
  const categoryIds = new Set(pack.categories.map((c) => c.id));

  // Начальные элементы
  if (pack.startingIds.length === 0) errors.push('Нет ни одного начального элемента (starting: true).');
  for (const id of pack.startingIds) {
    if (elements.get(id)?.secret) errors.push(`Начальный элемент "${id}" не может быть секретным.`);
    const producers = recipes.filter((r) => r.output === id);
    if (producers.length > 0) {
      errors.push(`Начальный элемент "${id}" создаётся рецептом (${producers.map((r) => r.source).join(', ')}).`);
    }
  }

  // Элементы: категории, иллюстрации
  for (const element of elements.values()) {
    if (!categoryIds.has(element.category)) {
      errors.push(`Элемент "${element.id}": неизвестная категория "${element.category}".`);
    }
    if (options.artExists && !options.artExists(element.art)) {
      errors.push(`Элемент "${element.id}": нет файла иллюстрации assets/${element.art}.`);
    }
  }

  // Рецепты: ссылки, дубликаты, конфликты
  const byKey = new Map<string, { output: string; source: string }>();
  for (const recipe of recipes) {
    for (const id of [...recipe.inputs, recipe.output]) {
      if (!elements.has(id)) errors.push(`${recipe.source}: несуществующий элемент "${id}".`);
    }
    const previous = byKey.get(recipe.key);
    if (previous) {
      if (previous.output === recipe.output) {
        errors.push(`Дубликат рецепта ${recipe.key} → ${recipe.output}: ${previous.source} и ${recipe.source}.`);
      } else {
        errors.push(
          `Конфликт: ${recipe.key} даёт "${previous.output}" (${previous.source}) и "${recipe.output}" (${recipe.source}).`,
        );
      }
    } else {
      byKey.set(recipe.key, { output: recipe.output, source: recipe.source });
    }
    if (recipe.inputs.includes(recipe.output)) {
      warnings.push(`${recipe.source}: результат "${recipe.output}" совпадает с одним из входов.`);
    }
  }
  for (const recipe of recipes.filter((r) => r.ordered)) {
    const [first, second] = recipe.inputs;
    const plain = byKey.get(unorderedKey(first, second));
    if (plain) {
      errors.push(
        `Конфликт порядка: для пары ${first} + ${second} есть и упорядоченный (${recipe.source}), и неупорядоченный (${plain.source}) рецепт.`,
      );
    }
    if (first === second) warnings.push(`${recipe.source}: упорядоченный рецепт из двух одинаковых элементов.`);
  }

  // Получение элементов
  const produced = new Set(recipes.map((r) => r.output));
  for (const element of elements.values()) {
    if (!element.starting && !produced.has(element.id)) {
      errors.push(`Элемент "${element.id}" не создаётся ни одним рецептом и не является начальным.`);
    }
  }

  // Достижимость
  const depth = computeDepths(pack);
  for (const element of elements.values()) {
    if (depth.has(element.id) || !produced.has(element.id)) continue;
    errors.push(
      `Элемент "${element.id}" недостижим из начальных: все его рецепты требуют недостижимых элементов (возможен замкнутый цикл).`,
    );
  }

  // Тупики
  const used = new Set(recipes.flatMap((r) => r.inputs));
  for (const element of elements.values()) {
    if (!element.final && !used.has(element.id)) {
      warnings.push(`Из элемента "${element.id}" ничего не создаётся; если так задумано, отметьте его "final": true.`);
    }
    if (element.final && used.has(element.id)) {
      warnings.push(`Элемент "${element.id}" отмечен final, но используется в рецептах.`);
    }
  }

  // Тексты
  for (const [locale, texts] of Object.entries(options.elementTexts ?? {})) {
    for (const element of elements.values()) {
      const text = texts[element.id];
      if (typeof text?.name !== 'string' || text.name.trim() === '') {
        errors.push(`[${locale}] Нет названия элемента "${element.id}".`);
      }
      if (typeof text?.description !== 'string' || text.description.trim() === '') {
        errors.push(`[${locale}] Нет описания элемента "${element.id}".`);
      }
    }
    for (const id of Object.keys(texts)) {
      if (!elements.has(id)) warnings.push(`[${locale}] Текст для несуществующего элемента "${id}".`);
    }
  }
  for (const [locale, texts] of Object.entries(options.categoryTexts ?? {})) {
    for (const id of categoryIds) {
      if (typeof texts[id] !== 'string') errors.push(`[${locale}] Нет названия категории "${id}".`);
    }
  }

  return {
    errors,
    warnings,
    stats: {
      elements: elements.size,
      recipes: recipes.length,
      starting: pack.startingIds.length,
      secret: [...elements.values()].filter((e) => e.secret).length,
      depth,
    },
  };
}
