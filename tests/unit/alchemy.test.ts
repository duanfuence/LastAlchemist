import { describe, expect, it } from 'vitest';
import { orderedKey, unorderedKey } from '../../src/core/alchemy/keys';
import { RecipeBook } from '../../src/core/alchemy/RecipeBook';
import { combine, countDiscoveries, createProgress } from '../../src/core/progress/progress';
import { BASIC_ELEMENTS, BASIC_RECIPES, makePack } from './helpers/content';

const pack = makePack(
  [...BASIC_ELEMENTS, { id: 'mist', final: true }, { id: 'smoke', final: true }],
  [
    ...BASIC_RECIPES,
    { in: ['air', 'water'], out: 'mist', ordered: true },
    { in: ['water', 'air'], out: 'smoke', ordered: true },
  ],
);
const book = new RecipeBook(pack);

describe('ключи рецептов', () => {
  it('неупорядоченный ключ не зависит от порядка', () => {
    expect(unorderedKey('water', 'fire')).toBe(unorderedKey('fire', 'water'));
    expect(unorderedKey('water', 'fire')).toBe('fire|water');
  });

  it('упорядоченный ключ различает порядок', () => {
    expect(orderedKey('air', 'water')).not.toBe(orderedKey('water', 'air'));
  });
});

describe('RecipeBook', () => {
  it('находит рецепт в прямом и обратном порядке', () => {
    const forward = book.find('water', 'fire');
    const reverse = book.find('fire', 'water');
    expect(forward).toMatchObject({ kind: 'recipe', recipe: { output: 'steam' } });
    expect(reverse).toEqual(forward);
  });

  it('упорядоченный рецепт зависит от того, какой элемент первый', () => {
    expect(book.find('air', 'water')).toMatchObject({ recipe: { output: 'mist' } });
    expect(book.find('water', 'air')).toMatchObject({ recipe: { output: 'smoke' } });
  });

  it('соединяет элемент с самим собой', () => {
    expect(book.find('water', 'water')).toMatchObject({ recipe: { output: 'sea' } });
  });

  it('сообщает об отсутствии рецепта', () => {
    expect(book.find('fire', 'fire')).toEqual({ kind: 'none' });
    expect(book.find('earth', 'air')).toEqual({ kind: 'none' });
  });

  it('сообщает о недопустимом ID', () => {
    expect(book.find('water', 'unobtainium')).toEqual({ kind: 'unknown-element', id: 'unobtainium' });
    expect(book.find('', 'water')).toEqual({ kind: 'unknown-element', id: '' });
  });

  it('всегда даёт один и тот же результат', () => {
    const results = Array.from({ length: 20 }, () => book.find('fire', 'water'));
    expect(new Set(results.map((r) => (r.kind === 'recipe' ? r.recipe.output : r.kind)))).toEqual(new Set(['steam']));
  });

  it('перечисляет рецепты элемента', () => {
    expect(book.recipesFor('steam').map((r) => r.key)).toEqual(['fire|water']);
  });
});

describe('combine', () => {
  it('открывает новый элемент', () => {
    const start = createProgress(pack);
    const { outcome, progress } = combine(book, start, 'water', 'fire');
    expect(outcome).toMatchObject({ kind: 'discovery', element: 'steam' });
    expect(progress.discovered).toContain('steam');
    expect(progress.recipes).toEqual(['fire|water']);
    expect(start.discovered).not.toContain('steam');
  });

  it('повторное получение не увеличивает число открытий', () => {
    const first = combine(book, createProgress(pack), 'water', 'fire').progress;
    const again = combine(book, first, 'fire', 'water');
    expect(again.outcome.kind).toBe('known');
    expect(again.progress.discovered).toEqual(first.discovered);
    expect(countDiscoveries(pack, again.progress).found).toBe(countDiscoveries(pack, first).found);
  });

  it('новый способ получить известный элемент отмечается отдельно', () => {
    const withMist = combine(book, createProgress(pack), 'air', 'water').progress;
    const pack2Book = new RecipeBook(
      makePack([...BASIC_ELEMENTS], [...BASIC_RECIPES, { in: ['earth', 'fire'], out: 'steam' }]),
    );
    const base = combine(pack2Book, createProgress(pack), 'water', 'fire').progress;
    const result = combine(pack2Book, base, 'earth', 'fire');
    expect(result.outcome.kind).toBe('new-recipe');
    expect(result.progress.discovered.filter((id) => id === 'steam')).toHaveLength(1);
    expect(withMist.discovered).toContain('mist');
  });

  it('не соединяет то, чего нет в рецептах, и не меняет прогресс', () => {
    const start = createProgress(pack);
    const result = combine(book, start, 'fire', 'fire');
    expect(result.outcome).toEqual({ kind: 'no-recipe' });
    expect(result.progress).toBe(start);
  });

  it('отклоняет неизвестные и ещё не открытые элементы', () => {
    const start = createProgress(pack);
    expect(combine(book, start, 'water', 'nope').outcome).toEqual({
      kind: 'invalid',
      reason: 'unknown-element',
      id: 'nope',
    });
    expect(combine(book, start, 'steam', 'air').outcome).toEqual({
      kind: 'invalid',
      reason: 'not-discovered',
      id: 'steam',
    });
  });

  it('использует полученный элемент в следующей комбинации', () => {
    const withSteam = combine(book, createProgress(pack), 'water', 'fire').progress;
    const result = combine(book, withSteam, 'air', 'steam');
    expect(result.outcome).toMatchObject({ kind: 'discovery', element: 'cloud' });
  });
});

describe('countDiscoveries', () => {
  it('не считает начальные и не показывает ненайденные секреты', () => {
    const start = createProgress(pack);
    expect(countDiscoveries(pack, start)).toEqual({ found: 0, total: 5, secretsFound: 0 });
  });

  it('после находки секрета он входит и в найденные, и во всего', () => {
    let progress = combine(book, createProgress(pack), 'water', 'fire').progress;
    progress = combine(book, progress, 'earth', 'steam').progress;
    expect(countDiscoveries(pack, progress)).toEqual({ found: 2, total: 6, secretsFound: 1 });
  });
});
