import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  createTranslator,
  getCatalog,
  resolveLocale,
  type Catalog,
} from '../../src/i18n';

describe('resolveLocale', () => {
  it('понимает коды с регионом', () => {
    expect(resolveLocale('ru-RU')).toBe('ru');
    expect(resolveLocale('RU')).toBe('ru');
  });

  it('возвращает язык по умолчанию для неподдерживаемых и пустых значений', () => {
    expect(resolveLocale('en')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});

describe('createTranslator', () => {
  const catalog: Catalog = {
    ui: { ...getCatalog('ru').ui, 'launch.footnote': 'Найдено {count} из {total}' },
    elements: { water: { name: 'Вода', description: 'Описание' } },
    categories: { primal: 'Первоначала' },
  };
  const i18n = createTranslator('ru', { ru: catalog });

  it('подставляет параметры', () => {
    expect(i18n.t('launch.footnote', { count: 3, total: 4 })).toBe('Найдено 3 из 4');
  });

  it('оставляет неизвестные параметры как есть', () => {
    expect(i18n.t('launch.footnote', { count: 3 })).toBe('Найдено 3 из {total}');
  });

  it('сообщает об отсутствующем тексте элемента', () => {
    expect(() => i18n.element('unknown')).toThrow(/unknown/);
  });

  it('называет категории и не падает на неизвестной', () => {
    expect(i18n.category('primal')).toBe('Первоначала');
    expect(i18n.category('nowhere')).toBe('nowhere');
  });
});

describe('каталоги', () => {
  const reference = getCatalog(DEFAULT_LOCALE);

  it.each(SUPPORTED_LOCALES)('язык %s содержит все ключи интерфейса без пустых строк', (locale) => {
    const catalog = getCatalog(locale);
    expect(Object.keys(catalog.ui).sort()).toEqual(Object.keys(reference.ui).sort());
    for (const value of Object.values(catalog.ui)) expect(value.trim()).not.toBe('');
  });

  it.each(SUPPORTED_LOCALES)('язык %s описывает четыре начальных элемента', (locale) => {
    const { elements } = getCatalog(locale);
    for (const id of ['water', 'fire', 'earth', 'air']) {
      expect(elements[id]?.name.trim()).toBeTruthy();
      expect(elements[id]?.description.trim()).toBeTruthy();
    }
  });
});
