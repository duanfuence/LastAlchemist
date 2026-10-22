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
  /** Прочитано, но часть данных отброшена (например, элемент удалён из базы). */
  | 'repaired'
  /** Сохранение не читается — начата новая книга, исходная строка сохраняется в резервную копию. */
  | 'corrupted';

export interface LoadResult {
  status: LoadStatus;
  progress: Progress;
  board: BoardSnapshotItem[];
  /** Пояснения для журнала разработчика: что именно отброшено. */
  notes: string[];
}

/** Миграции: версия → функция, переводящая данные в следующую версию. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function serializeSave(progress: Progress, board: readonly BoardSnapshotItem[], now = Date.now()): string {
  const data: SaveData = {
    v: SAVE_VERSION,
    savedAt: now,
    discovered: [...progress.discovered],
    recipes: [...progress.recipes],
    board: board.map(({ id, x, y }) => ({ id, x: round(x), y: round(y) })),
  };
  return JSON.stringify(data);
}

const round = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * Разбор сохранения. Никогда не бросает исключений: любые повреждения
 * приводят к статусу 'corrupted' или 'repaired', игра продолжает работать.
 */
export function parseSave(raw: string | null, content: ContentPack): LoadResult {
  const fresh = (status: LoadStatus, notes: string[] = []): LoadResult => ({
    status,
    progress: { discovered: [...content.startingIds], recipes: [] },
    board: [],
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
  let version = data['v'];
  if (version > SAVE_VERSION || version < 1) return fresh('corrupted', [`неизвестная версия формата ${version}`]);
  let record: Record<string, unknown> = data;
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return fresh('corrupted', [`нет миграции с версии ${version}`]);
    record = migrate(record);
    version += 1;
  }
  if (!Array.isArray(record['discovered']) || !Array.isArray(record['recipes'])) {
    return fresh('corrupted', ['нет списков открытий']);
  }

  const notes: string[] = [];
  const discovered: string[] = [...content.startingIds];
  for (const id of stringList(record['discovered'])) {
    if (!content.elements.has(id)) {
      notes.push(`неизвестный элемент "${id}" отброшен`);
      continue;
    }
    if (!discovered.includes(id)) discovered.push(id);
  }
  const recipeKeys = new Set(content.recipes.map((r) => r.key));
  const recipes: string[] = [];
  for (const key of stringList(record['recipes'])) {
    if (!recipeKeys.has(key)) {
      notes.push(`неизвестный рецепт "${key}" отброшен`);
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

  return { status: notes.length > 0 ? 'repaired' : 'ok', progress: { discovered, recipes }, board, notes };
}
