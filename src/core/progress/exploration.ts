import { computeDepths } from '../content/validate';
import type { ContentPack, RecipeDef } from '../content/types';
import type { Progress } from './progress';

/**
 * Исследование книги: что ещё можно открыть и куда подсказать.
 * Работает на той же базе рецептов, что и соединение (ContentPack.recipes), — второй системы нет.
 *
 * Понятия:
 * - «новое открытие» — рецепт, результат которого игрок ещё не открыл
 *   (новый способ получить известный элемент открытием не считается);
 * - «исследованный» элемент — ни один рецепт с его участием уже не даёт нового открытия,
 *   включая рецепты, второй ингредиент которых ещё не найден. Это окончательно, а не «пока»;
 * - «готовое» открытие — оба ингредиента уже открыты, соединение можно сделать сейчас.
 */

export function isNewDiscovery(recipe: RecipeDef, progress: Progress): boolean {
  return !progress.discovered.includes(recipe.output);
}

/**
 * Элементы, из которых больше нельзя получить ни одного нового открытия.
 * Тайный результат тоже считается: пока Гомункул не найден, его ингредиенты не «исследованы»
 * (имени тайного это не раскрывает, а только показывает, что элемент ещё не исчерпан).
 */
export function exploredElements(content: ContentPack, progress: Progress): Set<string> {
  const open = new Set<string>();
  for (const recipe of content.recipes) {
    if (isNewDiscovery(recipe, progress)) for (const id of recipe.inputs) open.add(id);
  }
  return new Set(progress.discovered.filter((id) => content.elements.has(id) && !open.has(id)));
}

/** Открытия, которые можно сделать прямо сейчас: оба ингредиента открыты, результат — нет. */
export function readyDiscoveries(content: ContentPack, progress: Progress): RecipeDef[] {
  return content.recipes.filter(
    (recipe) => isNewDiscovery(recipe, progress) && recipe.inputs.every((id) => progress.discovered.includes(id)),
  );
}

/** Открыты ли все обычные (не тайные) элементы. */
export function regularComplete(content: ContentPack, progress: Progress): boolean {
  for (const element of content.elements.values()) {
    if (!element.secret && !progress.discovered.includes(element.id)) return false;
  }
  return true;
}

export type HintResult =
  /** Первый шаг: один ингредиент готового открытия. */
  | { kind: 'ingredient'; element: string; recipe: RecipeDef }
  /** Второй шаг: оба ингредиента (для упорядоченного рецепта — в нужном порядке). */
  | { kind: 'pair'; first: string; second: string; recipe: RecipeDef }
  /** Открывать больше нечего: вся книга заполнена. */
  | { kind: 'complete' }
  /** Из открытых элементов сейчас не получить ничего нового (для этой базы не встречается). */
  | { kind: 'stuck' };

/**
 * Подсказки. Ведут только к готовым открытиям: оба ингредиента у игрока есть,
 * результат ещё не открыт, — поэтому подсказку всегда можно выполнить.
 * Выбор детерминирован: самое раннее по цепочке открытие (минимальная глубина), затем порядок базы.
 * Тайный элемент подсказывается, только когда все обычные уже открыты.
 * Подсказка «держится» за выбранное открытие, пока его не сделают: повторный вызов уточняет её.
 */
export class HintGuide {
  private readonly depth: ReadonlyMap<string, number>;
  private target: RecipeDef | null = null;
  private level = 0;

  constructor(private readonly content: ContentPack) {
    this.depth = computeDepths(content);
  }

  /** Текущее открытие, к которому ведёт подсказка (для подсветки), или null. */
  current(progress: Progress): RecipeDef | null {
    return this.target && isNewDiscovery(this.target, progress) ? this.target : null;
  }

  /** Сколько уже раскрыто по текущей подсказке: 0 — ничего, 1 — ингредиент, 2 — пара. */
  revealed(progress: Progress): number {
    return this.current(progress) ? this.level : 0;
  }

  /** Ингредиенты, уже названные текущей подсказкой: [] — ничего, один — после первого шага, оба — после второго. */
  revealedElements(progress: Progress): string[] {
    const recipe = this.current(progress);
    if (!recipe || this.level === 0) return [];
    return this.level >= 2 ? [...new Set(recipe.inputs)] : [this.lead(recipe)];
  }

  next(progress: Progress): HintResult {
    if (!this.current(progress)) {
      this.target = this.pick(progress);
      this.level = 0;
    }
    const recipe = this.target;
    if (!recipe) {
      const everything = [...this.content.elements.keys()].every((id) => progress.discovered.includes(id));
      return everything ? { kind: 'complete' } : { kind: 'stuck' };
    }
    this.level = Math.min(2, this.level + 1);
    const [first, second] = recipe.inputs;
    if (this.level === 1) return { kind: 'ingredient', element: this.lead(recipe), recipe };
    return { kind: 'pair', first, second, recipe };
  }

  private pick(progress: Progress): RecipeDef | null {
    const ready = readyDiscoveries(this.content, progress);
    const regular = ready.filter((recipe) => !this.content.elements.get(recipe.output)?.secret);
    const pool = regular.length > 0 ? regular : regularComplete(this.content, progress) ? ready : [];
    let best: RecipeDef | null = null;
    for (const recipe of pool) {
      if (!best || this.depthOf(recipe.output) < this.depthOf(best.output)) best = recipe;
    }
    return best;
  }

  /** Какой ингредиент назвать первым: более поздний по цепочке — его труднее угадать самому. */
  private lead(recipe: RecipeDef): string {
    const [first, second] = recipe.inputs;
    return this.depthOf(second) > this.depthOf(first) ? second : first;
  }

  private depthOf(id: string): number {
    return this.depth.get(id) ?? Number.POSITIVE_INFINITY;
  }
}
