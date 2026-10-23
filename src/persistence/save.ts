import type { BoardSnapshotItem } from '../core/board/board';
import type { ContentPack } from '../core/content/types';
import type { Progress } from '../core/progress/progress';

/** Текущая версия формата сохранения. При изменении формата добавить миграцию в MIGRATIONS. */
export const SAVE_VERSION = 1;

export interface SaveData {
  v: typeof SAVE_VERSION;
  savedAt: number;
  discovered: string[];
  recipes: string[];
  board: BoardSnapshotItem[];
}

export type LoadStatus =
  /** Сохранения нет — новая книга. */
  | 'empty'
  /** Сохранение прочитано полностью. */
  | 'ok'
  /** Прочитано, но часть данных не распознана (например, стол с ошибками). */
  | 'repaired'
  /**
   * Запись сделана более новой версией игры (номер формата больше известного).
   * Прочитано то, что удалось распознать, но запись трогать нельзя: эта версия её не понимает.
   */
  | 'newer'
  /** Сохранение не читается — начата новая книга, исходная строка сохраняется в резервную копию. */
  | 'corrupted';

/**
 * Данные, которые эта версия игры не понимает, но обязана сохранить при перезаписи:
 * элементы и рецепты из более новой базы, поля формата, добавленные позже.
 * Иначе запуск старой версии (откат, кэш) молча стёр бы прогресс новой.
 */
export interface PreservedData {
  discovered: string[];
  recipes: string[];
  fields: Record<string, unknown>;
}

export interface LoadResult {
  status: LoadStatus;
  progress: Progress;
  board: BoardSnapshotItem[];
  preserved: PreservedData;
  /** Версия формата исходной записи, если она была прочитана. */
  version?: number;
  /** Запись переведена миграциями из этой (более старой) версии. */
  migratedFrom?: number;
  /** Пояснения для журнала разработчика: что именно отброшено. */
  notes: string[];
}

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Миграции: версия → функция, переводящая данные в следующую версию. */
const MIGRATIONS: Record<number, Migration> = {};

export interface SaveFormat {
  version: number;
  migrations: Record<number, Migration>;
}

const FORMAT: SaveFormat = { version: SAVE_VERSION, migrations: MIGRATIONS };

/** Поля формата, которые разбирает эта версия; остальные переносятся как есть. */
const KNOWN_FIELDS = new Set(['v', 'savedAt', 'discovered', 'recipes', 'board']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const emptyPreserved = (): PreservedData => ({ discovered: [], recipes: [], fields: {} });

export function serializeSave(
  progress: Progress,
  board: readonly BoardSnapshotItem[],
  now = Date.now(),
  preserved: PreservedData = emptyPreserved(),
): string {
  const unique = (known: readonly string[], kept: readonly string[]): string[] => [
    ...known,
    ...kept.filter((item) => !known.includes(item)),
  ];
  const data = {
    ...preserved.fields,
    v: SAVE_VERSION,
    savedAt: now,
    discovered: unique(progress.discovered, preserved.discovered),
    recipes: unique(progress.recipes, preserved.recipes),
    board: board.map(({ id, x, y }) => ({ id, x: round(x), y: round(y) })),
  } satisfies SaveData & Record<string, unknown>;
  return JSON.stringify(data);
}

const round = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * Разбор сохранения. Никогда не бросает исключений: любые повреждения
 * приводят к статусу 'corrupted', 'repaired' или 'newer', игра продолжает работать.
 * format — только для тестов миграций.
 */
export function parseSave(raw: string | null, content: ContentPack, format: SaveFormat = FORMAT): LoadResult {
  const fresh = (status: LoadStatus, notes: string[] = []): LoadResult => ({
    status,
    progress: { discovered: [...content.startingIds], recipes: [] },
    board: [],
    preserved: emptyPreserved(),
    notes,
  });
  if (raw === null || raw === '') return fresh('empty');

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fresh('corrupted', ['сохранение не является корректным JSON']);
  }
  if (!isRecord(data) || typeof data['v'] !== 'number' || !Number.isInteger(data['v'])) {
    return fresh('corrupted', ['нет версии формата']);
  }
  const original = data['v'];
  if (original < 1) return fresh('corrupted', [`неизвестная версия формата ${original}`]);
  // Более новый формат: читаем, что понимаем, но статус запрещает перезапись
  const newer = original > format.version;
  let version = original;
  let record: Record<string, unknown> = data;
  try {
    while (version < format.version) {
      const migrate = format.migrations[version];
      if (!migrate) return fresh('corrupted', [`нет миграции с версии ${version}`]);
      record = migrate(record);
      version += 1;
    }
  } catch (error) {
    return fresh('corrupted', [`миграция с версии ${version} не удалась: ${String(error)}`]);
  }
  if (!Array.isArray(record['discovered']) || !Array.isArray(record['recipes'])) {
    return newer ? { ...fresh('newer', ['формат новой версии не распознан']), version: original } : fresh('corrupted', ['нет списков открытий']);
  }

  const notes: string[] = [];
  const preserved = emptyPreserved();
  for (const [key, value] of Object.entries(record)) {
    if (!KNOWN_FIELDS.has(key)) preserved.fields[key] = value;
  }
  const discovered: string[] = [...content.startingIds];
  for (const id of stringList(record['discovered'])) {
    if (!content.elements.has(id)) {
      // Элемент из более новой базы: в игре его нет, но в записи он остаётся
      if (!preserved.discovered.includes(id)) preserved.discovered.push(id);
      continue;
    }
    if (!discovered.includes(id)) discovered.push(id);
  }
  const recipeKeys = new Set(content.recipes.map((r) => r.key));
  const recipes: string[] = [];
  for (const key of stringList(record['recipes'])) {
    if (!recipeKeys.has(key)) {
      if (!preserved.recipes.includes(key)) preserved.recipes.push(key);
      continue;
    }
    if (!recipes.includes(key)) recipes.push(key);
  }

  const board: BoardSnapshotItem[] = [];
  const rawBoard: unknown[] = Array.isArray(record['board']) ? (record['board'] as unknown[]) : [];
  for (const item of rawBoard) {
    const valid =
      isRecord(item) &&
      typeof item['id'] === 'string' &&
      discovered.includes(item['id']) &&
      Number.isFinite(item['x']) &&
      Number.isFinite(item['y']);
    if (!valid) {
      notes.push('некорректный элемент на столе отброшен');
      continue;
    }
    const clamp = (v: number): number => Math.min(1, Math.max(0, v));
    board.push({ id: item['id'] as string, x: clamp(item['x'] as number), y: clamp(item['y'] as number) });
  }

  const status: LoadStatus = newer ? 'newer' : notes.length > 0 ? 'repaired' : 'ok';
  return {
    status,
    progress: { discovered, recipes },
    board,
    preserved,
    version: original,
    ...(original < format.version ? { migratedFrom: original } : {}),
    notes,
  };
}
