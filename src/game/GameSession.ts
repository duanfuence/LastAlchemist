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
import { HintGuide, exploredElements, type HintResult } from '../core/progress/exploration';
import { parseSave, serializeSave, type LoadStatus, type PreservedData } from '../persistence/save';
import type { LocalSaveStore } from '../persistence/LocalSaveStore';

/** Участник соединения: элемент на столе или элемент из списка (список бесконечен). */
export type CombineSource = { uid: number } | { elementId: string };

export interface CombineReport {
  outcome: CombineOutcome;
  first: string;
  second: string;
  /** Элемент-результат на столе: создаётся только при новом открытии. */
  result?: BoardItem;
  /** Элементы стола, израсходованные соединением (только при новом открытии). */
  consumed: number[];
}

/**
 * Игровая сессия: прогресс, рабочее поле и сохранение.
 * Правила соединения:
 * - новое открытие: участники со стола расходуются, результат появляется на месте цели;
 * - известный результат (известным или новым рецептом): стол не меняется — участники остаются
 *   на своих местах, второй экземпляр результата не создаётся, новый рецепт запоминается;
 * - нет рецепта: ничего не меняется;
 * - элементы из списка бесконечны и не расходуются никогда;
 * - повторное получение известного элемента не увеличивает число открытий.
 */
export class GameSession {
  readonly book: RecipeBook;
  readonly board = new BoardModel();
  /** Подсказки ведут только к открытиям, которые можно сделать из уже открытых элементов. */
  private readonly guide: HintGuide;
  private progressState: Progress;
  /** Данные записи, которые эта версия не понимает: возвращаются в запись при каждом сохранении. */
  private readonly preserved: PreservedData;
  private readonly listeners = new Set<() => void>();
  readonly loadStatus: LoadStatus;

  constructor(
    readonly content: ContentPack,
    private readonly store?: LocalSaveStore,
  ) {
    this.book = new RecipeBook(content);
    this.guide = new HintGuide(content);
    const raw = store?.read() ?? null;
    const loaded = parseSave(raw, content);
    this.loadStatus = loaded.status;
    this.preserved = loaded.preserved;
    if (loaded.status === 'corrupted' && raw !== null) {
      // Чистая книга записывается только после успешной резервной копии: исходные данные не теряются
      const saved = store?.backup(raw) ?? false;
      if (!saved) store?.lock();
      console.warn('Сохранение повреждено, начата новая книга:', loaded.notes.join('; '));
    } else if (loaded.status === 'newer') {
      // Запись новой версии игры: эта версия её не перезаписывает ни при каких действиях
      store?.lock();
      console.warn(`Сохранение сделано более новой версией игры (формат ${loaded.version}); запись отключена.`);
    } else if (loaded.status === 'repaired') {
      console.warn('Сохранение исправлено:', loaded.notes.join('; '));
    }
    this.progressState = loaded.status === 'corrupted' ? createProgress(content) : loaded.progress;
    this.board.restore(loaded.board, (id) => this.progressState.discovered.includes(id));
    if (loaded.status === 'corrupted') this.persist();
    // Запись старого формата остаётся нетронутой до первого изменения: тогда она уже переведена
  }

  /** Прогресс не сохраняется: запись принадлежит более новой версии или её нельзя было скопировать. */
  get readOnly(): boolean {
    return this.store?.readOnly ?? false;
  }

  get progress(): Progress {
    return this.progressState;
  }

  get counts(): DiscoveryCounts {
    return countDiscoveries(this.content, this.progressState);
  }

  /** Элементы, из которых больше не получить ни одного нового открытия. */
  get explored(): ReadonlySet<string> {
    return exploredElements(this.content, this.progressState);
  }

  /** Следующий шаг подсказки: сначала один ингредиент, затем пара. Прогресс не меняет. */
  hint(): HintResult {
    return this.guide.next(this.progressState);
  }

  /** Ингредиенты, уже названные подсказкой, пока её открытие не сделано (для подсветки в списке). */
  get hintedElements(): readonly string[] {
    return this.guide.revealedElements(this.progressState);
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

    // Новый рецепт известного элемента запоминается, но стол не трогается:
    // участники остаются игроку, а уже открытый результат и так есть в списке
    this.progressState = progress;
    if (outcome.kind === 'discovery') {
      const anchor = at ?? this.position(second) ?? this.position(first) ?? { x: 0.5, y: 0.5 };
      for (const source of [first, second]) {
        if ('uid' in source) {
          this.board.remove(source.uid);
          report.consumed.push(source.uid);
        }
      }
      const result = this.board.add(outcome.element, anchor.x, anchor.y);
      if (result) report.result = result;
    }
    if (outcome.kind !== 'known') this.changed();
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
    this.store?.schedule(serializeSave(this.progressState, this.board.snapshot(), Date.now(), this.preserved));
  }
}
