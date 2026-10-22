/**
 * Типы контента. Тексты (названия, описания) лежат в файлах локализации и сюда не входят:
 * структура игры не зависит от языка.
 */

export interface ElementDef {
  /** Стабильный идентификатор: латиница, цифры, «_». Не меняется после выпуска — на него ссылаются сохранения. */
  readonly id: string;
  readonly category: string;
  /** Путь к иллюстрации относительно каталога assets/, например "elements/water.svg". */
  readonly art: string;
  /** Начальный элемент: доступен с первого запуска, не создаётся рецептами. */
  readonly starting: boolean;
  /** Секретный элемент: не входит в отображаемое «всего», пока не найден. */
  readonly secret: boolean;
  /** Из элемента намеренно ничего не создаётся (не ошибка базы). */
  readonly final: boolean;
}

export interface RecipeDef {
  /** Ключ рецепта: "a|b" для неупорядоченного (ID по алфавиту) или "a>b" для упорядоченного. */
  readonly key: string;
  readonly inputs: readonly [string, string];
  readonly output: string;
  /** Важен порядок: первый — элемент, который переносят (или выбирают первым), второй — цель. */
  readonly ordered: boolean;
  /** Файл, из которого взят рецепт, — для понятных сообщений проверки. */
  readonly source: string;
}

export interface CategoryDef {
  readonly id: string;
  readonly order: number;
}

export interface ContentPack {
  readonly elements: ReadonlyMap<string, ElementDef>;
  readonly recipes: readonly RecipeDef[];
  readonly categories: readonly CategoryDef[];
  readonly startingIds: readonly string[];
}

/** Исходные данные в том виде, как они лежат в JSON-файлах content/. */
export interface RawElement {
  id?: unknown;
  category?: unknown;
  art?: unknown;
  starting?: unknown;
  secret?: unknown;
  final?: unknown;
}

export interface RawRecipe {
  in?: unknown;
  out?: unknown;
  ordered?: unknown;
}

export interface RawContentFiles {
  /** Путь файла → массив элементов. */
  elements: Record<string, unknown>;
  /** Путь файла → массив рецептов. */
  recipes: Record<string, unknown>;
  categories: unknown;
}
