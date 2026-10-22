import ruUi from '../../content/locales/ru/ui.json';
import ruElements from '../../content/locales/ru/elements.json';
import ruCategories from '../../content/locales/ru/categories.json';

/**
 * Локализация. Тексты лежат в content/locales/<язык>/ и не смешиваются с кодом.
 * Чтобы добавить язык: создать каталог с теми же ключами, добавить код в SUPPORTED_LOCALES
 * и запись в CATALOGS. Проверка типов не даст пропустить ключ интерфейса.
 */

export const SUPPORTED_LOCALES = ['ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

export type UiKey = keyof typeof ruUi;

export interface ElementText {
  name: string;
  description: string;
}

export interface Catalog {
  ui: Record<UiKey, string>;
  elements: Record<string, ElementText>;
  categories: Record<string, string>;
}

const CATALOGS: Record<Locale, Catalog> = {
  ru: { ui: ruUi, elements: ruElements, categories: ruCategories },
};

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Выбирает поддерживаемый язык по коду платформы или браузера ("ru", "ru-RU", "en"). */
export function resolveLocale(requested?: string | null): Locale {
  const code = requested?.trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return isSupportedLocale(code) ? code : DEFAULT_LOCALE;
}

export interface Translator {
  readonly locale: Locale;
  t(key: UiKey, params?: Record<string, string | number>): string;
  element(id: string): ElementText;
  category(id: string): string;
}

export function createTranslator(locale: Locale, catalogs: Record<Locale, Catalog> = CATALOGS): Translator {
  const catalog = catalogs[locale];
  return {
    locale,
    t(key, params) {
      const template = catalog.ui[key];
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match,
      );
    },
    element(id) {
      const text = catalog.elements[id];
      if (!text) throw new Error(`Нет текста элемента "${id}" для языка "${locale}"`);
      return text;
    },
    category(id) {
      return catalog.categories[id] ?? id;
    },
  };
}

export function getCatalog(locale: Locale): Catalog {
  return CATALOGS[locale];
}
