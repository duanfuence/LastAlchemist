import type { RecipeBook } from '../alchemy/RecipeBook';
import type { ContentPack, RecipeDef } from '../content/types';

/** Прогресс игрока. Только растёт: открытия и найденные рецепты не теряются. */
export interface Progress {
  /** Открытые элементы в порядке открытия, включая начальные. */
  readonly discovered: readonly string[];
  /** Ключи рецептов, которые игрок уже применял. */
  readonly recipes: readonly string[];
}

export type CombineOutcome =
  /** Новый элемент. */
  | { kind: 'discovery'; element: string; recipe: RecipeDef }
  /** Известный элемент, но получен новым способом. */
  | { kind: 'new-recipe'; element: string; recipe: RecipeDef }
  /** Известный элемент известным способом. */
  | { kind: 'known'; element: string; recipe: RecipeDef }
  /** Такого соединения нет. */
  | { kind: 'no-recipe' }
  /** Элемент не существует или ещё не открыт игроком. */
  | { kind: 'invalid'; reason: 'unknown-element' | 'not-discovered'; id: string };

export interface CombineResult {
  outcome: CombineOutcome;
  progress: Progress;
}

export interface DiscoveryCounts {
  /** Уникальные открытия: открытые элементы, кроме начальных (секретные включены). */
  found: number;
  /** Сколько всего можно открыть, не считая начальных и ещё не найденных секретных. */
  total: number;
  secretsFound: number;
}

export function createProgress(content: ContentPack): Progress {
  return { discovered: [...content.startingIds], recipes: [] };
}

/**
 * Соединение двух элементов. Чистая функция: возвращает новый прогресс, не меняя прежний.
 * first — переносимый (выбранный первым) элемент, second — цель.
 */
export function combine(book: RecipeBook, progress: Progress, first: string, second: string): CombineResult {
  const lookup = book.find(first, second);
  if (lookup.kind === 'unknown-element') {
    return { outcome: { kind: 'invalid', reason: 'unknown-element', id: lookup.id }, progress };
  }
  for (const id of [first, second]) {
    if (!progress.discovered.includes(id)) {
      return { outcome: { kind: 'invalid', reason: 'not-discovered', id }, progress };
    }
  }
  if (lookup.kind === 'none') return { outcome: { kind: 'no-recipe' }, progress };

  const { recipe } = lookup;
  const elementKnown = progress.discovered.includes(recipe.output);
  const recipeKnown = progress.recipes.includes(recipe.key);
  const next: Progress = {
    discovered: elementKnown ? progress.discovered : [...progress.discovered, recipe.output],
    recipes: recipeKnown ? progress.recipes : [...progress.recipes, recipe.key],
  };
  const kind = !elementKnown ? 'discovery' : !recipeKnown ? 'new-recipe' : 'known';
  return { outcome: { kind, element: recipe.output, recipe }, progress: next };
}

export function countDiscoveries(content: ContentPack, progress: Progress): DiscoveryCounts {
  let found = 0;
  let secretsFound = 0;
  for (const id of new Set(progress.discovered)) {
    const element = content.elements.get(id);
    if (!element || element.starting) continue;
    found += 1;
    if (element.secret) secretsFound += 1;
  }
  let total = 0;
  for (const element of content.elements.values()) {
    if (!element.starting && !element.secret) total += 1;
  }
  return { found, total: total + secretsFound, secretsFound };
}
