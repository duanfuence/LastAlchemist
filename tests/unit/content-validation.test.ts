import { describe, expect, it } from 'vitest';
import { assembleContent } from '../../src/core/content/assemble';
import { computeDepths, validateContent } from '../../src/core/content/validate';
import { readContentFromDisk } from '../../tools/lib/read-content';
import { BASIC_ELEMENTS, BASIC_RECIPES, makeFiles, type MiniElement } from './helpers/content';

function check(elements: MiniElement[], recipes: { in: unknown; out: unknown; ordered?: boolean }[]) {
  const assembled = assembleContent(makeFiles(elements, recipes));
  return validateContent(assembled.pack, { assembleIssues: assembled.issues });
}

describe('база игры', () => {
  const { assembled, options } = readContentFromDisk();
  const report = validateContent(assembled.pack, options);

  it('проходит проверку без ошибок и предупреждений', () => {
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('содержит четыре начальных элемента и прототипный объём рецептов', () => {
    expect([...assembled.pack.startingIds].sort()).toEqual(['air', 'earth', 'fire', 'water']);
    expect(report.stats.recipes).toBeGreaterThanOrEqual(20);
    expect(report.stats.recipes).toBeLessThanOrEqual(35);
  });

  it('все элементы достижимы из начальных', () => {
    const depth = computeDepths(assembled.pack);
    for (const id of assembled.pack.elements.keys()) expect(depth.has(id), id).toBe(true);
  });
});

describe('validateContent', () => {
  it('чистая тестовая база корректна', () => {
    expect(check(BASIC_ELEMENTS, BASIC_RECIPES).errors).toEqual([]);
  });

  it('находит дубликат элемента', () => {
    const report = check([...BASIC_ELEMENTS, { id: 'steam' }], BASIC_RECIPES);
    expect(report.errors.join('\n')).toMatch(/Дубликат элемента "steam"/);
  });

  it('находит дубликат рецепта, в том числе с переставленными входами', () => {
    const report = check(BASIC_ELEMENTS, [...BASIC_RECIPES, { in: ['fire', 'water'], out: 'steam' }]);
    expect(report.errors.join('\n')).toMatch(/Дубликат рецепта fire\|water → steam/);
  });

  it('находит конфликтующие рецепты', () => {
    const report = check(BASIC_ELEMENTS, [...BASIC_RECIPES, { in: ['fire', 'water'], out: 'cloud' }]);
    expect(report.errors.join('\n')).toMatch(/Конфликт: fire\|water даёт "steam".*и "cloud"/);
  });

  it('находит конфликт упорядоченного и неупорядоченного рецепта для одной пары', () => {
    const report = check(BASIC_ELEMENTS, [...BASIC_RECIPES, { in: ['fire', 'water'], out: 'cloud', ordered: true }]);
    expect(report.errors.join('\n')).toMatch(/Конфликт порядка/);
  });

  it('находит ссылки на несуществующие элементы во входах и в результате', () => {
    const report = check(BASIC_ELEMENTS, [
      ...BASIC_RECIPES,
      { in: ['water', 'ghost'], out: 'steam' },
      { in: ['earth', 'earth'], out: 'phantom' },
    ]);
    const text = report.errors.join('\n');
    expect(text).toMatch(/несуществующий элемент "ghost"/);
    expect(text).toMatch(/несуществующий элемент "phantom"/);
  });

  it('находит элемент без рецептов', () => {
    const report = check([...BASIC_ELEMENTS, { id: 'orphan', final: true }], BASIC_RECIPES);
    expect(report.errors.join('\n')).toMatch(/"orphan" не создаётся ни одним рецептом/);
  });

  it('находит недостижимые элементы в замкнутом цикле', () => {
    const report = check(
      [...BASIC_ELEMENTS, { id: 'yin' }, { id: 'yang' }],
      [...BASIC_RECIPES, { in: ['yin', 'water'], out: 'yang' }, { in: ['yang', 'water'], out: 'yin' }],
    );
    const text = report.errors.join('\n');
    expect(text).toMatch(/"yin" недостижим/);
    expect(text).toMatch(/"yang" недостижим/);
  });

  it('находит некорректные начальные элементы', () => {
    const noStart = check(
      BASIC_ELEMENTS.map((e) => ({ ...e, starting: false })),
      BASIC_RECIPES,
    );
    expect(noStart.errors.join('\n')).toMatch(/Нет ни одного начального элемента/);

    const secretStart = check([...BASIC_ELEMENTS, { id: 'aether', starting: true, secret: true }], BASIC_RECIPES);
    expect(secretStart.errors.join('\n')).toMatch(/"aether" не может быть секретным/);

    const producedStart = check(BASIC_ELEMENTS, [...BASIC_RECIPES, { in: ['steam', 'steam'], out: 'water' }]);
    expect(producedStart.errors.join('\n')).toMatch(/Начальный элемент "water" создаётся рецептом/);
  });

  it('находит ошибки формата: id, число входов, категория', () => {
    const text = check(
      [...BASIC_ELEMENTS, { id: 'Bad Id' }, { id: 'lost', category: 'nowhere', final: true }],
      [...BASIC_RECIPES, { in: ['water'], out: 'steam' }, { in: ['earth', 'air'], out: 'lost' }],
    ).errors.join('\n');
    expect(text).toMatch(/некорректный id "Bad Id"/);
    expect(text).toMatch(/ровно два ID/);
    expect(text).toMatch(/неизвестная категория "nowhere"/);
  });

  it('принимает иллюстрации SVG и WebP, другие форматы — нет', () => {
    const elements = BASIC_ELEMENTS.map((e) =>
      e.id === 'water' ? { ...e, art: 'elements/water.webp' } : e.id === 'fire' ? { ...e, art: 'elements/fire.png' } : e,
    );
    const text = check(elements, BASIC_RECIPES).errors.join('\n');
    expect(text).not.toMatch(/"water": некорректный путь/);
    expect(text).toMatch(/"fire": некорректный путь к иллюстрации "elements\/fire\.png"/);
  });

  it('проверяет тексты, категории и иллюстрации', () => {
    const assembled = assembleContent(makeFiles(BASIC_ELEMENTS, BASIC_RECIPES));
    const report = validateContent(assembled.pack, {
      elementTexts: { ru: { water: { name: 'Вода', description: '' } } },
      categoryTexts: { ru: {} },
      artExists: (path) => path !== 'elements/fire.svg',
    });
    const text = report.errors.join('\n');
    expect(text).toMatch(/\[ru\] Нет описания элемента "water"/);
    expect(text).toMatch(/\[ru\] Нет названия элемента "fire"/);
    expect(text).toMatch(/\[ru\] Нет названия категории "test"/);
    expect(text).toMatch(/нет файла иллюстрации assets\/elements\/fire\.svg/);
  });

  it('предупреждает о тупиковых элементах без пометки final', () => {
    const report = check(
      BASIC_ELEMENTS.map((e) => (e.id === 'cloud' ? { id: 'cloud' } : e)),
      BASIC_RECIPES,
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings.join('\n')).toMatch(/Из элемента "cloud" ничего не создаётся/);
  });

  it('считает глубину цепочек', () => {
    const assembled = assembleContent(makeFiles(BASIC_ELEMENTS, BASIC_RECIPES));
    const depth = computeDepths(assembled.pack);
    expect(depth.get('water')).toBe(0);
    expect(depth.get('steam')).toBe(1);
    expect(depth.get('cloud')).toBe(2);
  });
});
