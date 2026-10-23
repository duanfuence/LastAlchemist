import { describe, expect, it } from 'vitest';
import { readContentFromDisk } from '../../tools/lib/read-content';
import { RecipeBook } from '../../src/core/alchemy/RecipeBook';
import { HintGuide, exploredElements, readyDiscoveries, regularComplete } from '../../src/core/progress/exploration';
import { combine, createProgress, type Progress } from '../../src/core/progress/progress';
import { makePack } from './helpers/content';

const content = readContentFromDisk().assembled.pack;
const book = new RecipeBook(content);
const all = [...content.elements.keys()];
const regular = all.filter((id) => !content.elements.get(id)!.secret);
const progressOf = (discovered: string[]): Progress => ({ discovered: [...new Set([...content.startingIds, ...discovered])], recipes: [] });

/** Выполняет подсказку до конца (ингредиент → пара) и соединяет пару. */
function followHint(guide: HintGuide, progress: Progress) {
  const first = guide.next(progress);
  if (first.kind !== 'ingredient') return { first, progress };
  const second = guide.next(progress);
  expect(second.kind).toBe('pair');
  if (second.kind !== 'pair') throw new Error('ожидалась пара');
  // Подсказанное можно выполнить: оба ингредиента уже у игрока
  expect(progress.discovered).toContain(second.first);
  expect(progress.discovered).toContain(second.second);
  expect([second.first, second.second]).toContain(first.element);
  const result = combine(book, progress, second.first, second.second);
  return { first, second, result, progress: result.progress };
}

describe('подсказки на настоящей базе', () => {
  it('начало игры: первый шаг — один ингредиент, второй — пара, пара даёт новое открытие', () => {
    const guide = new HintGuide(content);
    const start = createProgress(content);
    const { result } = followHint(guide, start);
    expect(result?.outcome.kind).toBe('discovery');
  });

  it('следуя только подсказкам, игрок открывает всю книгу, и ни одна подсказка не ведёт к известному', () => {
    const guide = new HintGuide(content);
    let progress = createProgress(content);
    const order: string[] = [];
    for (let step = 0; step < 40; step += 1) {
      const followed = followHint(guide, progress);
      if (followed.first.kind === 'complete') break;
      expect(followed.result?.outcome.kind).toBe('discovery');
      if (followed.result?.outcome.kind === 'discovery') order.push(followed.result.outcome.element);
      progress = followed.progress;
    }
    expect(order).toHaveLength(all.length - content.startingIds.length);
    // Тайный подсказывается последним — после всех обычных
    expect(order.at(-1)).toBe('homunculus');
    expect(guide.next(progress)).toEqual({ kind: 'complete' });
  });

  it('в любом достижимом состоянии подсказка выполнима и ведёт к неоткрытому (500 случайных прохождений)', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let run = 0; run < 500; run += 1) {
      let progress = createProgress(content);
      const steps = Math.floor(random() * 30);
      for (let i = 0; i < steps; i += 1) {
        const ready = readyDiscoveries(content, progress);
        if (ready.length === 0) break;
        const recipe = ready[Math.floor(random() * ready.length)]!;
        progress = combine(book, progress, recipe.inputs[0], recipe.inputs[1]).progress;
      }
      const guide = new HintGuide(content);
      const hint = guide.next(progress);
      if (hint.kind === 'complete') {
        expect(progress.discovered).toHaveLength(all.length);
        continue;
      }
      expect(hint.kind).toBe('ingredient');
      if (hint.kind !== 'ingredient') continue;
      expect(progress.discovered).not.toContain(hint.recipe.output);
      expect(hint.recipe.inputs.every((id) => progress.discovered.includes(id))).toBe(true);
      // Тайный не подсказывается, пока не открыты все обычные
      if (content.elements.get(hint.recipe.output)!.secret) expect(regularComplete(content, progress)).toBe(true);
    }
  });

  it('середина игры: подсказка выбирает самое раннее по цепочке готовое открытие', () => {
    const guide = new HintGuide(content);
    const progress = progressOf(['steam', 'mud', 'lava', 'energy', 'rain', 'dust', 'sea', 'stone', 'cloud']);
    const hint = guide.next(progress);
    expect(hint.kind).toBe('ingredient');
    // Ветер (Воздух + Воздух) — открытие первого шага, оно ещё не сделано
    if (hint.kind === 'ingredient') expect(hint.recipe.output).toBe('wind');
  });

  it('почти полная книга: подсказывается последний обычный элемент, а не тайный', () => {
    const guide = new HintGuide(content);
    const progress = progressOf(all.filter((id) => id !== 'cinnabar' && id !== 'homunculus'));
    const hint = guide.next(progress);
    expect(hint.kind === 'ingredient' && hint.recipe.output).toBe('cinnabar');
  });

  it('все обычные открыты: подсказка ведёт к тайному', () => {
    const guide = new HintGuide(content);
    const progress = progressOf(regular);
    const first = guide.next(progress);
    const second = guide.next(progress);
    expect(first.kind === 'ingredient' && first.recipe.output).toBe('homunculus');
    expect(second).toMatchObject({ kind: 'pair' });
    if (second.kind === 'pair') expect([second.first, second.second].sort()).toEqual(['life', 'mercury']);
  });

  it('Гомункул открыт: подсказывать больше нечего', () => {
    const guide = new HintGuide(content);
    expect(guide.next(progressOf(all))).toEqual({ kind: 'complete' });
  });

  it('подсказка держится за своё открытие и сбрасывается, когда его сделали', () => {
    const guide = new HintGuide(content);
    let progress = createProgress(content);
    const first = guide.next(progress);
    if (first.kind !== 'ingredient') throw new Error('ожидался ингредиент');
    // Игрок сделал другое открытие — подсказка остаётся прежней и уточняется
    const other = readyDiscoveries(content, progress).find((r) => r.key !== first.recipe.key)!;
    progress = combine(book, progress, other.inputs[0], other.inputs[1]).progress;
    const second = guide.next(progress);
    expect(second).toMatchObject({ kind: 'pair', recipe: first.recipe });
    expect(guide.revealed(progress)).toBe(2);
    // Повторное нажатие не раскрывает ничего нового
    expect(guide.next(progress)).toMatchObject({ kind: 'pair', recipe: first.recipe });
    // Подсказанное открытие сделано — следующая подсказка начинается заново, с ингредиента
    progress = combine(book, progress, first.recipe.inputs[0], first.recipe.inputs[1]).progress;
    expect(guide.revealed(progress)).toBe(0);
    const next = guide.next(progress);
    expect(next.kind).toBe('ingredient');
    if (next.kind === 'ingredient') expect(next.recipe.key).not.toBe(first.recipe.key);
  });

  it('если из открытого ничего нового не получить, подсказка честно говорит об этом', () => {
    // a + b = c, но b недостижим: проверка базы такое отклоняет, подсказка всё равно не обещает лишнего
    const pack = makePack([{ id: 'a', starting: true }, { id: 'b' }, { id: 'c', final: true }], [{ in: ['a', 'b'], out: 'c' }]);
    expect(new HintGuide(pack).next({ discovered: ['a'], recipes: [] })).toEqual({ kind: 'stuck' });
  });
});

describe('исследованные элементы', () => {
  it('в начале игры исследованных нет', () => {
    expect(exploredElements(content, createProgress(content)).size).toBe(0);
  });

  it('Ветер исследован сразу после открытия: из него ничего не создаётся', () => {
    expect(exploredElements(content, progressOf(['wind'])).has('wind')).toBe(true);
  });

  it('элемент не исследован, пока есть рецепт с неоткрытым результатом — даже если второй ингредиент ещё не найден', () => {
    // У Пара один рецепт: Пар + Воздух = Облако. Облако не открыто — Пар не исследован
    expect(exploredElements(content, progressOf(['steam'])).has('steam')).toBe(false);
    // Облако открыто — из Пара больше ничего не получить
    expect(exploredElements(content, progressOf(['steam', 'cloud'])).has('steam')).toBe(true);
  });

  it('ингредиенты тайного не исследованы, пока он не найден; после — исследовано всё', () => {
    const noSecret = exploredElements(content, progressOf(regular));
    expect(noSecret.has('life')).toBe(false);
    expect(noSecret.has('mercury')).toBe(false);
    expect(noSecret.has('salt')).toBe(true);
    expect(exploredElements(content, progressOf(all)).size).toBe(all.length);
  });

  it('статус учитывает только открытые элементы', () => {
    const explored = exploredElements(content, progressOf(['wind']));
    expect([...explored].every((id) => ['water', 'fire', 'earth', 'air', 'wind'].includes(id))).toBe(true);
  });
});
