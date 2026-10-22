import { RecipeBook } from '../core/alchemy/RecipeBook';
import { BoardModel, type BoardItem } from '../core/board/board';
import type { ContentPack } from '../core/content/types';
import {
  combine,
  countDiscoveries,
  createProgress,
  type CombineOutcome,
  type DiscoveryCounts,
  type Progress,
} from '../core/progress/progress';
import { parseSave, serializeSave, type LoadStatus } from '../persistence/save';
import type { LocalSaveStore } from '../persistence/LocalSaveStore';

/** Участник соединения: элемент на столе или элемент из списка (список бесконечен). */
export type CombineSource = { uid: number } | { elementId: string };

export interface CombineReport {
  outcome: CombineOutcome;
  first: string;
  second: string;
  /** Элемент-результат на столе (при успешном соединении). */
  result?: BoardItem;
  /** Элементы стола, израсходованные соединением. */
  consumed: number[];
}

/**
 * Игровая сессия: прогресс, рабочее поле и сохранение.
 * Правила соединения:
 * - при успехе оба участника расходуются, результат появляется на месте цели;
 * - при неудаче ничего не меняется;
 * - повторное получение известного элемента не увеличивает число открытий.
 */
export class GameSession {
  readonly book: RecipeBook;
  readonly board = new BoardModel();
  private progressState: Progress;
  private readonly listeners = new Set<() => void>();
  readonly loadStatus: LoadStatus;

  constructor(
    readonly content: ContentPack,
    private readonly store?: LocalSaveStore,
  ) {
    this.book = new RecipeBook(content);
    const raw = store?.read() ?? null;
    const loaded = parseSave(raw, content);
    this.loadStatus = loaded.status;
    if (loaded.status === 'corrupted' && raw !== null) {
      store?.backup(raw);
      console.warn('Сохранение повреждено, начата новая книга:', loaded.notes.join('; '));
    } else if (loaded.status === 'repaired') {
      console.warn('Сохранение исправлено:', loaded.notes.join('; '));
    }
    this.progressState = loaded.status === 'corrupted' ? createProgress(content) : loaded.progress;
    this.board.restore(loaded.board, (id) => this.progressState.discovered.includes(id));
    if (loaded.status === 'corrupted') this.persist();
  }

  get progress(): Progress {
    return this.progressState;
  }

  get counts(): DiscoveryCounts {
    return countDiscoveries(this.content, this.progressState);
  }

  isDiscovered(id: string): boolean {
    return this.progressState.discovered.includes(id);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  place(elementId: string, x: number, y: number): BoardItem | undefined {
    if (!this.isDiscovered(elementId)) return undefined;
    const item = this.board.add(elementId, x, y);
    if (item) this.changed();
    return item;
  }

  move(uid: number, x: number, y: number): void {
    if (!this.board.get(uid)) return;
    this.board.move(uid, x, y);
    this.board.bringToFront(uid);
    this.changed();
  }

  remove(uid: number): void {
    if (!this.board.get(uid)) return;
    this.board.remove(uid);
    this.changed();
  }

  clearBoard(): void {
    if (this.board.all.length === 0) return;
    this.board.clear();
    this.changed();
  }

  /**
   * Соединяет два элемента. first — переносимый (выбранный первым), second — цель.
   * at — где появится результат; по умолчанию на месте цели.
   */
  combine(first: CombineSource, second: CombineSource, at?: { x: number; y: number }): CombineReport | undefined {
    const firstId = this.resolve(first);
    const secondId = this.resolve(second);
    if (!firstId || !secondId) return undefined;
    if ('uid' in first && 'uid' in second && first.uid === second.uid) return undefined;

    const { outcome, progress } = combine(this.book, this.progressState, firstId, secondId);
    const report: CombineReport = { outcome, first: firstId, second: secondId, consumed: [] };
    if (outcome.kind === 'no-recipe' || outcome.kind === 'invalid') return report;

    const anchor = at ?? this.position(second) ?? this.position(first) ?? { x: 0.5, y: 0.5 };
    for (const source of [first, second]) {
      if ('uid' in source) {
        this.board.remove(source.uid);
        report.consumed.push(source.uid);
      }
    }
    this.progressState = progress;
    const result = this.board.add(outcome.element, anchor.x, anchor.y);
    if (result) report.result = result;
    this.changed();
    return report;
  }

  /** Немедленная запись (при сворачивании и закрытии страницы). */
  flush(): void {
    this.store?.flush();
  }

  private resolve(source: CombineSource): string | undefined {
    if ('uid' in source) return this.board.get(source.uid)?.elementId;
    return this.isDiscovered(source.elementId) ? source.elementId : undefined;
  }

  private position(source: CombineSource): { x: number; y: number } | undefined {
    if (!('uid' in source)) return undefined;
    const item = this.board.get(source.uid);
    return item ? { x: item.x, y: item.y } : undefined;
  }

  private changed(): void {
    this.persist();
    for (const listener of this.listeners) listener();
  }

  private persist(): void {
    this.store?.schedule(serializeSave(this.progressState, this.board.snapshot()));
  }
}
