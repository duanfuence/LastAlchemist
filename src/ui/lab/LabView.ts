import {
  clampToBoard,
  findDropTarget,
  findFreeSpot,
  type BoardGeometry,
  type BoardItem,
} from '../../core/board/board';
import type { RecipeDef } from '../../core/content/types';
import type { SoundSystem } from '../../audio';
import type { CombineReport, CombineSource, GameSession } from '../../game/GameSession';
import type { Translator } from '../../i18n';
import { uiArt } from '../art';
import { el } from '../dom';
import { ScrollEdgeWatcher } from '../scrollEdges';
import type { StoryEntryId } from '../../core/progress/story';
import type { Atmosphere } from '../Atmosphere';
import { SoundControl } from '../SoundControl';
import { DragController, type PointerPoint } from './DragController';
import { medal } from './medal';
import { playReaction } from './reaction';
import { Toast } from './Toast';

type DragSource = { kind: 'catalog'; elementId: string } | { kind: 'board'; uid: number };

export interface LabDeps {
  session: GameSession;
  i18n: Translator;
  sound: SoundSystem;
  /** Атмосферные эффекты: их переключатель — в панели настроек на столе. */
  atmosphere?: Atmosphere;
  /** Наступили сюжетные записи (после анимации открытия). */
  onStory?: (entries: readonly StoryEntryId[]) => void;
  onExit(): void;
}

/** Запись появляется после реакции открытия, чтобы игрок увидел и то и другое. */
const STORY_DELAY_MS = 1500;

/** Задержка звука открытия после звука реакции (мс): сначала соединение, затем результат. */
const DISCOVERY_SOUND_DELAY_MS = 160;

/** Длительность растворения соединяемых элементов (согласована с CSS). */
const MERGE_MS = 300;
/** Возврат перенесённого элемента на прежнее место (согласован с CSS). */
const RETURN_MS = 260;
/** Удержание пальца, после которого элемент из вкладного листа можно нести на стол. */
const HOLD_TO_DRAG_MS = 280;
/** Сколько держится сообщение о неудаче или открытии, прежде чем вернуть подсказку. */
const MESSAGE_MS = 4000;

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Разворот книги: список — левая страница, вкладной лист не нужен. Совпадает с медиазапросом в CSS. */
const SPREAD_QUERY = '(orientation: landscape) and (min-width: 640px)';

/**
 * Лаборатория: список открытых элементов, рабочий стол, верхняя панель.
 * Вся игровая логика — в GameSession; здесь только отображение и ввод.
 */
export class LabView {
  readonly root: HTMLElement;
  readonly bar: HTMLElement;

  private readonly session: GameSession;
  private readonly onStory: ((entries: readonly StoryEntryId[]) => void) | undefined;
  private readonly i18n: Translator;
  private readonly sound: SoundSystem;
  private readonly board: HTMLElement;
  private readonly itemsLayer: HTMLElement;
  private readonly catalog: HTMLElement;
  private readonly catalogDock: HTMLElement;
  private readonly sheetContext: HTMLElement;
  private readonly coach: HTMLElement;
  /** Рецепт для подсказки первого опыта: первый в базе рецепт из двух разных начальных элементов. */
  private readonly coachRecipe: RecipeDef | undefined;
  private readonly catalogScroll: HTMLElement;
  private readonly catalogList: HTMLElement;
  private readonly catalogToggle: HTMLButtonElement;
  private readonly catalogCount: HTMLElement;
  private readonly hintButton: HTMLButtonElement;
  /** Текст текущей подсказки: держится в подписи стола, пока подсказанное открытие не сделано. */
  private hintText: string | null = null;
  /** Исследованные элементы на момент последней отрисовки: чтобы сообщить о новых. */
  private explored: ReadonlySet<string> = new Set();
  private readonly counterValue: HTMLElement;
  private readonly counterSecrets: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly captionText: HTMLElement;
  private readonly captionRemove: HTMLButtonElement;
  private readonly toast = new Toast();
  private readonly drag: DragController<DragSource>;
  private readonly itemNodes = new Map<number, HTMLButtonElement>();
  private readonly fresh = new Set<string>();
  private selected: number | null = null;
  private ghost: HTMLElement | null = null;
  private hoverTarget: HTMLElement | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: LabDeps) {
    this.session = deps.session;
    this.onStory = deps.onStory;
    this.i18n = deps.i18n;
    this.sound = deps.sound;
    const t = this.i18n.t.bind(this.i18n);

    // Верхняя панель на столе, над книгой
    const back = el('button', {
      className: 'desk-bar__button desk-bar__back',
      attrs: { type: 'button', 'aria-label': t('lab.backLabel'), 'data-testid': 'lab-back' },
    }, [el('span', { className: 'desk-bar__arrow', text: '‹', attrs: { 'aria-hidden': 'true' } }), el('span', { className: 'desk-bar__wide', text: t('lab.back') })]);
    back.addEventListener('click', () => {
      this.session.flush();
      deps.onExit();
    });
    const clear = el('button', {
      className: 'desk-bar__button',
      attrs: { type: 'button', 'data-testid': 'clear-board' },
    }, [el('span', { className: 'desk-bar__wide', text: t('lab.clear') }), el('span', { className: 'desk-bar__narrow', text: t('lab.clearShort') })]);
    clear.addEventListener('click', () => this.clearBoard());
    this.counterValue = el('span', { className: 'desk-bar__count', attrs: { 'data-testid': 'discovery-count' } });
    this.counterSecrets = el('span', { className: 'desk-bar__secrets' });
    this.counter = el('p', { className: 'desk-bar__counter', attrs: { role: 'status' } }, [
      el('span', { className: 'desk-bar__wide', text: `${t('lab.counter')} ` }),
      this.counterValue,
      this.counterSecrets,
    ]);
    // Уведомления об открытиях появляются в панели над книгой и не закрывают стол
    this.bar = el('header', { className: 'desk-bar' }, [
      back,
      el('div', { className: 'desk-bar__center' }, [
        el('p', { className: 'desk-bar__title', text: t('app.title') }),
        this.counter,
        this.toast.root,
      ]),
      new SoundControl(this.sound, this.i18n, deps.atmosphere).root,
      clear,
    ]);

    // Список элементов
    this.catalogCount = el('span', { className: 'catalog__count' });
    this.catalogToggle = el('button', {
      className: 'catalog__toggle',
      attrs: { type: 'button', 'aria-expanded': 'false', 'data-testid': 'catalog-toggle' },
    });
    this.catalogToggle.addEventListener('click', () => this.toggleCatalog());
    this.hintButton = el('button', {
      className: 'catalog__hint',
      text: t('lab.hint'),
      attrs: { type: 'button', 'aria-label': t('lab.hintLabel'), 'data-testid': 'hint' },
    });
    this.hintButton.addEventListener('click', () => this.showNextHint());
    this.catalogList = el('ul', { className: 'catalog__list' });
    this.catalogScroll = el('div', { className: 'catalog__scroll' }, [this.catalogList]);
    this.sheetContext = el('p', { className: 'catalog__context', attrs: { 'data-testid': 'sheet-context' } });
    this.sheetContext.hidden = true;
    this.catalog = el('aside', { className: 'catalog', attrs: { 'data-testid': 'catalog' } }, [
      el('div', { className: 'catalog__head' }, [
        el('h2', { className: 'catalog__title', text: t('lab.catalogTitle') }),
        this.catalogCount,
        this.hintButton,
        this.catalogToggle,
      ]),
      this.sheetContext,
      this.catalogScroll,
    ]);
    // Место ленты в раскладке: на время открытия вкладного листа его высота фиксируется,
    // поэтому стол не сжимается и элементы на нём не сдвигаются
    this.catalogDock = el('div', { className: 'catalog-dock' }, [this.catalog]);
    new ScrollEdgeWatcher(this.catalogScroll, this.catalog).contentChanged();

    // Рабочий стол
    this.itemsLayer = el('div', { className: 'board__items' });
    this.captionText = el('span', { className: 'board__caption-text', attrs: { 'data-testid': 'board-caption' } });
    this.captionRemove = el('button', {
      className: 'ghost-button board__remove',
      text: t('lab.remove'),
      attrs: { type: 'button', 'data-testid': 'remove-selected' },
    });
    this.captionRemove.hidden = true;
    this.captionRemove.addEventListener('click', () => {
      if (this.selected !== null) this.removeItem(this.selected);
    });
    this.coachRecipe = this.session.content.recipes.find((recipe) => {
      const [a, b] = recipe.inputs;
      return a !== b && this.session.content.startingIds.includes(a) && this.session.content.startingIds.includes(b);
    });
    this.coach = el('div', { className: 'board__coach', attrs: { 'data-testid': 'coach', 'aria-live': 'polite' } });
    this.coach.hidden = true;
    this.board = el('div', {
      className: 'board',
      attrs: { role: 'group', 'aria-label': t('lab.boardLabel'), 'data-testid': 'board' },
    }, [
      uiArt('emblem', 'board__emblem'),
      this.coach,
      this.itemsLayer,
      el('div', { className: 'board__caption', attrs: { 'aria-live': 'polite' } }, [this.captionText, this.captionRemove]),
    ]);
    this.board.addEventListener('click', (event) => {
      // Касание видимой части стола закрывает вкладной лист
      if (this.sheetOpen) {
        this.closeSheet();
        return;
      }
      // Касание пустого места снимает выделение
      if (event.target === this.board || event.target === this.itemsLayer) this.select(null);
    });

    this.root = el('section', { className: 'lab', attrs: { 'data-screen': 'lab' } }, [this.catalogDock, this.board]);
    this.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (this.sheetOpen) {
        this.closeSheet();
        this.catalogToggle.focus();
      } else {
        this.select(null);
      }
    });
    // При повороте в разворот вкладной лист не нужен: список становится левой страницей
    window.matchMedia(SPREAD_QUERY).addEventListener('change', (event) => {
      if (event.matches) this.closeSheet();
    });

    this.drag = new DragController<DragSource>({
      onStart: (source, point) => this.dragStart(source, point),
      onMove: (source, point) => this.dragMove(source, point),
      onDrop: (source, point) => this.dragDrop(source, point),
      onCancel: (source) => this.dragCancel(source),
    });

    this.explored = this.session.explored;
    this.renderCatalog();
    this.renderBoard();
    this.renderCounter();
    this.showHint();
  }

  /** Вызывается при уходе со страницы лаборатории. */
  detach(): void {
    this.drag.abort();
    this.removeGhost();
    this.toast.hide();
    if (this.messageTimer) clearTimeout(this.messageTimer);
  }

  // ---------- Отрисовка ----------

  private renderCounter(): void {
    const { found, total, secretsFound } = this.session.counts;
    this.counterValue.textContent = this.i18n.t('lab.counterValue', { found, total });
    this.counterSecrets.textContent = secretsFound > 0 ? ` · ${this.i18n.t('lab.secrets', { count: secretsFound })}` : '';
    this.counter.setAttribute('aria-label', this.i18n.t('lab.counterLabel', { found, total }));
    this.catalogCount.textContent = String(this.session.progress.discovered.length);
  }

  private renderCatalog(): void {
    const { content, progress } = this.session;
    const items: HTMLElement[] = [];
    for (const category of content.categories) {
      const ids = progress.discovered.filter((id) => content.elements.get(id)?.category === category.id);
      if (ids.length === 0) continue;
      items.push(el('li', { className: 'catalog__group', text: this.i18n.category(category.id), attrs: { 'aria-hidden': 'true' } }));
      for (const id of ids) {
        const entry = el('li', { className: 'catalog__entry' }, [this.catalogItem(id)]);
        // Свёрнутая лента: свежие открытия первыми, за ними начальные элементы в исходном порядке
        const start = content.startingIds.indexOf(id);
        entry.style.setProperty('--order', String(start >= 0 ? start : -progress.discovered.indexOf(id)));
        items.push(entry);
      }
    }
    this.catalogList.replaceChildren(...items);
    this.updateCatalogLabels();
    this.updateCatalogToggle();
    this.updateCoach();
  }

  private catalogItem(elementId: string): HTMLButtonElement {
    const name = this.i18n.element(elementId).name;
    const explored = this.explored.has(elementId) ? ' is-explored' : '';
    const button = el('button', {
      className: `catalog-item${this.fresh.has(elementId) ? ' is-fresh' : ''}${explored}`,
      attrs: { type: 'button', 'data-element': elementId, 'data-testid': `catalog-${elementId}` },
    }, [medal(this.session.content, elementId), el('span', { className: 'catalog-item__name', text: name })]);
    button.addEventListener('click', () => this.activateCatalog(elementId));
    // В открытом листе список прокручивается вертикально, поэтому пальцем элемент берут удержанием
    this.drag.bind(button, () => ({ kind: 'catalog', elementId }), (pointerType) =>
      pointerType === 'touch' && this.sheetOpen ? HOLD_TO_DRAG_MS : 0,
    );
    return button;
  }

  private updateCatalogLabels(): void {
    const key = this.selected === null ? 'lab.catalogItemLabel' : 'lab.catalogItemCombineLabel';
    for (const button of this.catalogList.querySelectorAll<HTMLButtonElement>('.catalog-item')) {
      const id = button.dataset['element'] ?? '';
      const label = this.i18n.t(key, { name: this.i18n.element(id).name });
      button.setAttribute('aria-label', this.explored.has(id) ? `${label} ${this.i18n.t('lab.exploredLabel')}` : label);
    }
  }

  private renderBoard(): void {
    const items = this.session.board.all;
    const alive = new Set(items.map((item) => item.uid));
    for (const [uid, node] of this.itemNodes) {
      if (!alive.has(uid)) {
        node.remove();
        this.itemNodes.delete(uid);
      }
    }
    items.forEach((item, index) => {
      const node = this.itemNodes.get(item.uid) ?? this.createItemNode(item);
      this.position(node, item.x, item.y);
      node.style.zIndex = String(index + 1);
      node.classList.toggle('is-selected', item.uid === this.selected);
    });
    this.board.classList.toggle('is-empty', items.length === 0);
    this.updateCoach();
  }

  private createItemNode(item: BoardItem): HTMLButtonElement {
    const name = this.i18n.element(item.elementId).name;
    const node = el('button', {
      className: 'board-item',
      attrs: {
        type: 'button',
        'data-uid': String(item.uid),
        'data-element': item.elementId,
        'aria-label': this.i18n.t('lab.itemLabel', { name }),
      },
    }, [medal(this.session.content, item.elementId), el('span', { className: 'board-item__name', text: name })]);
    node.addEventListener('click', () => this.activateItem(item.uid));
    node.addEventListener('keydown', (event) => this.itemKey(event, item.uid));
    this.drag.bind(node, () => ({ kind: 'board', uid: item.uid }));
    this.itemNodes.set(item.uid, node);
    this.itemsLayer.append(node);
    return node;
  }

  private position(node: HTMLElement, x: number, y: number): void {
    node.style.left = `${x * 100}%`;
    node.style.top = `${y * 100}%`;
  }

  // ---------- Геометрия ----------

  /** Координаты элементов считаются в слое над подписью стола, чтобы элементы её не закрывали. */
  private geometry(forPlacement: boolean): BoardGeometry {
    const rect = this.itemsLayer.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(this.board).getPropertyValue('--item-size')) || 64;
    // Для размещения учитываем подпись под медальоном, для попадания — только медальон
    return { width: rect.width, height: rect.height, itemSize: forPlacement ? size * 1.5 : size };
  }

  private boardPoint(clientX: number, clientY: number): { x: number; y: number; inside: boolean } {
    const layer = this.itemsLayer.getBoundingClientRect();
    const board = this.board.getBoundingClientRect();
    const inside = clientX >= board.left && clientX <= board.right && clientY >= board.top && clientY <= board.bottom;
    return { x: (clientX - layer.left) / layer.width, y: (clientY - layer.top) / layer.height, inside };
  }

  private isOverCatalog(clientX: number, clientY: number): boolean {
    const rect = this.catalog.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  private freeSpot(near?: { x: number; y: number }): { x: number; y: number } {
    const geometry = this.geometry(true);
    let preferred = near;
    // Пока видна записка первого опыта, новые элементы ложатся ниже неё, чтобы не закрыть текст
    if (!preferred && !this.coach.hidden && geometry.height > 0) {
      const layer = this.itemsLayer.getBoundingClientRect();
      const below = (this.coach.getBoundingClientRect().bottom - layer.top + geometry.itemSize * 0.55) / geometry.height;
      preferred = { x: 0.5, y: Math.min(0.9, Math.max(0.45, below)) };
    }
    return findFreeSpot(this.session.board.all, geometry, preferred);
  }

  // ---------- Нажатия и клавиатура ----------

  private activateCatalog(elementId: string): void {
    this.closeSheet();
    if (this.selected !== null) {
      const target = this.selected;
      this.combine({ elementId }, { uid: target });
      return;
    }
    this.placeFromCatalog(elementId, this.freeSpot());
  }

  private activateItem(uid: number): void {
    if (this.selected === null) {
      this.select(uid);
    } else if (this.selected === uid) {
      this.select(null);
    } else {
      this.combine({ uid: this.selected }, { uid });
    }
  }

  private itemKey(event: KeyboardEvent, uid: number): void {
    const item = this.session.board.get(uid);
    if (!item) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.removeItem(uid);
      return;
    }
    const step = event.shiftKey ? 0.08 : 0.025;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const target = clampToBoard(item.x + move[0], item.y + move[1], this.geometry(true));
    this.session.move(uid, target.x, target.y);
    this.renderBoard();
    this.itemNodes.get(uid)?.focus();
  }

  private select(uid: number | null): void {
    this.selected = uid;
    for (const [id, node] of this.itemNodes) node.classList.toggle('is-selected', id === uid);
    this.updateCatalogLabels();
    this.board.classList.toggle('has-selection', uid !== null);
    this.updateSheetContext();
    this.updateCoach();
    if (uid === null) {
      this.showHint();
      return;
    }
    const item = this.session.board.get(uid);
    if (!item) return;
    const text = this.i18n.element(item.elementId);
    const explored = this.explored.has(item.elementId) ? ` ${this.i18n.t('lab.exploredNote')}` : '';
    this.setCaption(`${text.name}. ${text.description}${explored} ${this.i18n.t('lab.hintSelected')}`, true);
  }

  // ---------- Перетаскивание ----------

  private dragStart(source: DragSource, point: PointerPoint): void {
    this.select(null);
    // Взятый из листа элемент несут на стол — лист уходит, открывая весь стол
    this.closeSheet();
    if (source.kind === 'catalog') {
      this.ghost = el('div', { className: 'drag-ghost', attrs: { 'aria-hidden': 'true' } }, [
        medal(this.session.content, source.elementId),
      ]);
      this.ghost.style.setProperty('--item-size', getComputedStyle(this.board).getPropertyValue('--item-size'));
      document.body.append(this.ghost);
    } else {
      this.itemNodes.get(source.uid)?.classList.add('is-dragging');
    }
    this.dragMove(source, point);
  }

  private dragMove(source: DragSource, point: PointerPoint): void {
    const centerX = point.clientX - point.offsetX;
    const centerY = point.clientY - point.offsetY;
    if (source.kind === 'catalog' && this.ghost) {
      this.ghost.style.transform = `translate(${centerX}px, ${centerY}px)`;
    }
    const at = this.boardPoint(centerX, centerY);
    if (source.kind === 'board') {
      const node = this.itemNodes.get(source.uid);
      if (node) this.position(node, at.x, at.y);
    }
    const target = at.inside
      ? findDropTarget(this.session.board.all, at, this.geometry(false), source.kind === 'board' ? source.uid : undefined)
      : undefined;
    const targetNode = target ? this.itemNodes.get(target.uid) ?? null : null;
    if (targetNode !== this.hoverTarget) {
      this.hoverTarget?.classList.remove('is-target');
      targetNode?.classList.add('is-target');
      this.hoverTarget = targetNode;
    }
    this.catalog.classList.toggle('is-drop-remove', source.kind === 'board' && this.isOverCatalog(point.clientX, point.clientY));
  }

  private dragDrop(source: DragSource, point: PointerPoint): void {
    const centerX = point.clientX - point.offsetX;
    const centerY = point.clientY - point.offsetY;
    const at = this.boardPoint(centerX, centerY);
    const overCatalog = this.isOverCatalog(point.clientX, point.clientY);
    this.clearDragState(source);

    if (source.kind === 'board') {
      if (overCatalog) {
        this.removeItem(source.uid);
        return;
      }
      if (!at.inside) {
        this.renderBoard();
        return;
      }
      const target = findDropTarget(this.session.board.all, at, this.geometry(false), source.uid);
      if (target) {
        this.combine({ uid: source.uid }, { uid: target.uid }, { x: at.x, y: at.y });
        return;
      }
      const spot = clampToBoard(at.x, at.y, this.geometry(true));
      this.session.move(source.uid, spot.x, spot.y);
      this.renderBoard();
      this.sound.play('place');
      return;
    }

    if (!at.inside) return;
    const target = findDropTarget(this.session.board.all, at, this.geometry(false));
    if (target) {
      this.combine({ elementId: source.elementId }, { uid: target.uid }, { x: at.x, y: at.y });
      return;
    }
    this.placeFromCatalog(source.elementId, clampToBoard(at.x, at.y, this.geometry(true)));
  }

  private dragCancel(source: DragSource): void {
    this.clearDragState(source);
    this.renderBoard();
  }

  private clearDragState(source: DragSource): void {
    this.removeGhost();
    this.hoverTarget?.classList.remove('is-target');
    this.hoverTarget = null;
    this.catalog.classList.remove('is-drop-remove');
    if (source.kind === 'board') this.itemNodes.get(source.uid)?.classList.remove('is-dragging');
  }

  private removeGhost(): void {
    this.ghost?.remove();
    this.ghost = null;
  }

  // ---------- Действия ----------

  private placeFromCatalog(elementId: string, spot: { x: number; y: number }): void {
    const item = this.session.place(elementId, spot.x, spot.y);
    if (!item) {
      this.flashMessage(this.i18n.t('lab.boardFull'));
      return;
    }
    this.useFresh(elementId);
    this.renderBoard();
    this.animate(this.itemNodes.get(item.uid), 'is-placed');
    this.sound.play('place');
    this.showHint();
  }

  /**
   * Соединение. firstDrop — точка, куда отпущен переносимый элемент:
   * при неудаче он остаётся рядом с целью, не перекрывая её.
   */
  private combine(first: CombineSource, second: CombineSource, firstDrop?: { x: number; y: number }): void {
    // Место соединения запоминаем до хода: после удачного соединения участников на столе уже нет
    const target = 'uid' in second ? this.session.board.get(second.uid) : undefined;
    const spot = target ? { x: target.x, y: target.y } : firstDrop;
    const report = this.session.combine(first, second);
    this.select(null);
    if (!report) return;
    const { outcome } = report;

    if (outcome.kind === 'no-recipe' || outcome.kind === 'invalid') {
      this.rejected(report, first, second, firstDrop);
      return;
    }
    // Известный результат: стол не меняется. Перенесённый элемент возвращается на своё место,
    // оба участника коротко откликаются — сочетание узнано
    if (outcome.kind !== 'discovery') this.returnDragged(first, 'is-recognized', second);

    // Новое открытие: участники исчезают на месте цели, затем появляется результат
    const targetNode = 'uid' in second ? this.itemNodes.get(second.uid) : undefined;
    for (const uid of report.consumed) {
      const node = this.itemNodes.get(uid);
      if (!node) continue;
      this.itemNodes.delete(uid);
      if (targetNode && node !== targetNode) {
        node.style.left = targetNode.style.left;
        node.style.top = targetNode.style.top;
      }
      node.classList.add('is-merging');
      node.disabled = true;
      setTimeout(() => node.remove(), prefersReducedMotion() ? 0 : MERGE_MS);
    }
    this.useFresh(report.first);
    this.useFresh(report.second);
    if (outcome.kind === 'discovery') this.fresh.add(outcome.element);

    const before = this.explored;
    this.explored = this.session.explored;
    const newlyExplored = [...this.explored].filter((id) => !before.has(id));
    this.renderBoard();
    this.renderCounter();
    this.renderCatalog();
    // Новое открытие должно быть видно в начале ленты и списка
    if (outcome.kind === 'discovery') this.catalogScroll.scrollTo({ left: 0 });
    const resultNode = report.result ? this.itemNodes.get(report.result.uid) : undefined;
    const secret = outcome.kind === 'discovery' && this.session.content.elements.get(outcome.element)?.secret === true;
    resultNode?.classList.toggle('is-secret', secret);
    this.animate(resultNode, outcome.kind === 'discovery' ? 'is-discovery' : 'is-born');
    if (outcome.kind === 'discovery') this.animate(this.counter, 'is-bumped');
    // Реакция над местом соединения: золото — только для нового знания
    const at = report.result ?? spot;
    if (at) playReaction(this.itemsLayer, at, outcome.kind !== 'discovery' ? 'known' : secret ? 'secret' : 'discovery');
    this.sound.play('react');
    if (outcome.kind === 'discovery') {
      setTimeout(() => this.sound.play(secret ? 'secret' : 'discover'), DISCOVERY_SOUND_DELAY_MS);
    }

    const labels = {
      discovery: ['lab.discovery', 'lab.discoveryShort'],
      'new-recipe': ['lab.newRecipe', 'lab.newRecipeShort'],
      known: ['lab.known', 'lab.knownShort'],
    } as const;
    const [full, short] = labels[outcome.kind];
    const text = this.i18n.element(outcome.element);
    this.toast.show(outcome.kind, this.i18n.t(full), this.i18n.t(short), text.name, medal(this.session.content, outcome.element));
    if (outcome.kind === 'discovery') {
      // Сделано подсказанное открытие — подсказка выполнена
      if (this.session.hintedElements.length === 0) this.hintText = null;
      const names = newlyExplored.map((id) => this.i18n.element(id).name).join(', ');
      const explored = names ? ` ${this.i18n.t(newlyExplored.length > 1 ? 'lab.nowExploredMany' : 'lab.nowExplored', { names })}` : '';
      this.flashMessage(`${text.name}. ${text.description}${explored}`);
      if (report.story.length > 0) {
        const entries = [...report.story];
        setTimeout(() => this.onStory?.(entries), prefersReducedMotion() ? 0 : STORY_DELAY_MS);
      }
    } else {
      // Известный результат на стол не кладётся: подпись объясняет, куда делись участники
      const name = (id: string): string => this.i18n.element(id).name;
      const key = outcome.kind === 'new-recipe' ? 'lab.newRecipeCaption' : 'lab.knownCaption';
      this.flashMessage(this.i18n.t(key, { first: name(report.first), second: name(report.second), result: text.name }));
    }
  }

  private rejected(
    report: CombineReport,
    first: CombineSource,
    second: CombineSource,
    firstDrop?: { x: number; y: number },
  ): void {
    // Элемент, принесённый из списка, кладётся рядом с целью, не перекрывая её;
    // элемент со стола возвращается на своё место — участники остаются там, где были
    if (firstDrop && 'uid' in second && !('uid' in first)) {
      const target = this.session.board.get(second.uid);
      const spot = findFreeSpot(this.session.board.all, this.geometry(true), target ? { x: target.x, y: target.y } : firstDrop);
      const placed = this.session.place(first.elementId, spot.x, spot.y);
      if (placed) this.useFresh(first.elementId);
    }
    this.returnDragged(first, 'is-rejected', second);
    this.sound.play('fail');
    const name = (id: string): string => this.i18n.element(id).name;
    this.flashMessage(this.i18n.t('lab.noRecipe', { first: name(report.first), second: name(report.second) }));
  }

  /**
   * Участники остаются на столе: позиции берутся из сессии (перенесённый элемент плавно
   * возвращается туда, откуда его взяли), затем оба отмечаются анимацией отклика.
   */
  private returnDragged(first: CombineSource, feedback: 'is-recognized' | 'is-rejected', second: CombineSource): void {
    const dragged = 'uid' in first ? this.itemNodes.get(first.uid) : undefined;
    if (dragged && !prefersReducedMotion()) {
      dragged.classList.add('is-returning');
      setTimeout(() => dragged.classList.remove('is-returning'), RETURN_MS);
    }
    this.renderBoard();
    for (const source of [first, second]) {
      if ('uid' in source) this.animate(this.itemNodes.get(source.uid), feedback);
    }
  }

  private removeItem(uid: number): void {
    const item = this.session.board.get(uid);
    if (!item) return;
    if (this.selected === uid) this.select(null);
    this.session.remove(uid);
    this.renderBoard();
    this.flashMessage(this.i18n.t('lab.removed', { name: this.i18n.element(item.elementId).name }));
  }

  private clearBoard(): void {
    this.select(null);
    this.session.clearBoard();
    this.renderBoard();
    this.flashMessage(this.i18n.t('lab.cleared'));
  }

  private useFresh(elementId: string): void {
    if (!this.fresh.delete(elementId)) return;
    this.catalogList.querySelector(`[data-element="${elementId}"]`)?.classList.remove('is-fresh');
  }

  private get sheetOpen(): boolean {
    return this.catalog.hasAttribute('data-expanded');
  }

  private toggleCatalog(): void {
    if (this.sheetOpen) this.closeSheet();
    else this.openSheet();
  }

  private openSheet(): void {
    if (this.sheetOpen || window.matchMedia(SPREAD_QUERY).matches) return;
    this.catalogDock.style.height = `${this.catalogDock.getBoundingClientRect().height}px`;
    this.catalog.setAttribute('data-expanded', '');
    this.root.setAttribute('data-sheet-open', '');
    this.catalogScroll.scrollTo({ top: 0, left: 0 });
    this.updateSheetContext();
    this.updateCatalogToggle(true);
  }

  private closeSheet(): void {
    if (!this.sheetOpen) return;
    this.catalog.removeAttribute('data-expanded');
    this.root.removeAttribute('data-sheet-open');
    this.catalogDock.style.removeProperty('height');
    this.updateCatalogToggle(false);
  }

  /** В открытом листе видно, с каким элементом стола будет соединён выбранный. */
  private updateSheetContext(): void {
    const item = this.selected === null ? undefined : this.session.board.get(this.selected);
    this.sheetContext.hidden = !item;
    if (item) {
      this.sheetContext.textContent = this.i18n.t('lab.sheetCombine', { name: this.i18n.element(item.elementId).name });
    }
  }

  private updateCatalogToggle(expanded = this.catalog.hasAttribute('data-expanded')): void {
    const full = this.i18n.t(expanded ? 'lab.catalogCollapse' : 'lab.catalogExpand');
    // На узком экране рядом с «Подсказкой» помещается только короткая подпись; полная — для чтения с экрана
    if (expanded) {
      this.catalogToggle.textContent = full;
    } else {
      this.catalogToggle.replaceChildren(
        el('span', { className: 'catalog__toggle-wide', text: full }),
        el('span', { className: 'catalog__toggle-narrow', text: this.i18n.t('lab.catalogExpandShort'), attrs: { 'aria-hidden': 'true' } }),
      );
    }
    this.catalogToggle.setAttribute('aria-label', full);
    this.catalogToggle.setAttribute('aria-expanded', String(expanded));
  }

  // ---------- Подсказка первого опыта ----------

  /**
   * Короткая записка, ведущая к первому открытию. Состояние выводится из прогресса и стола,
   * отдельного флага нет: после первого открытия записка больше не появляется.
   */
  private updateCoach(): void {
    const recipe = this.coachRecipe;
    const active = recipe !== undefined && this.session.counts.found === 0;
    this.coach.hidden = !active;
    // Подсвечены ингредиенты записки первого опыта или уже названные подсказкой
    const suggested: readonly string[] = active ? recipe.inputs : this.session.hintedElements;
    for (const button of this.catalogList.querySelectorAll<HTMLElement>('.catalog-item')) {
      button.classList.toggle('is-suggested', suggested.includes(button.dataset['element'] ?? ''));
    }
    if (!active) return;
    const [firstId, secondId] = recipe.inputs;
    const first = this.i18n.element(firstId).name;
    const second = this.i18n.element(secondId).name;
    const selected = this.selected === null ? undefined : this.session.board.get(this.selected);
    const onBoard = this.session.board.all.some((item) => item.elementId === firstId);
    const step = selected?.elementId === firstId ? 'lab.coachSecond' : onBoard ? 'lab.coachCombine' : 'lab.coachPlace';
    this.coach.replaceChildren(
      el('span', { className: 'board__coach-title', text: this.i18n.t('lab.coachTitle', { first, second }) }),
      el('span', { className: 'board__coach-text', text: this.i18n.t(step, { first, second }) }),
    );
    this.coach.dataset['step'] = step.replace('lab.coach', '').toLowerCase();
  }

  // ---------- Подписи и анимации ----------

  private showHint(): void {
    if (this.messageTimer) return;
    // Подсказка, о которой попросили, держится в подписи, пока её открытие не сделано
    if (this.hintText && this.session.hintedElements.length > 0) {
      this.setCaption(this.hintText, false);
      return;
    }
    // Пока видна записка первого опыта, общая подсказка её не дублирует
    if (!this.coach.hidden) {
      this.setCaption('', false);
      return;
    }
    this.hintText = null;
    const empty = this.session.board.all.length === 0;
    this.setCaption(this.i18n.t(empty ? 'lab.hintEmpty' : 'lab.hintIdle'), false);
  }

  /** Кнопка «Подсказка»: первый раз — один ингредиент, второй — пара; в подписи стола до открытия. */
  private showNextHint(): void {
    const hint = this.session.hint();
    const name = (id: string): string => this.i18n.element(id).name;
    if (hint.kind === 'complete' || hint.kind === 'stuck') {
      this.hintText = null;
      this.updateCoach();
      this.flashMessage(this.i18n.t(hint.kind === 'complete' ? 'lab.hintComplete' : 'lab.hintStuck'));
      return;
    }
    if (hint.kind === 'ingredient') {
      this.hintText = this.i18n.t('lab.hintIngredient', { name: name(hint.element) });
    } else {
      const key = hint.recipe.ordered ? 'lab.hintPairOrdered' : hint.first === hint.second ? 'lab.hintPairSame' : 'lab.hintPair';
      this.hintText = this.i18n.t(key, { first: name(hint.first), second: name(hint.second) });
    }
    this.updateCoach();
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = null;
    if (this.selected !== null) this.select(null);
    this.showHint();
    this.animate(this.captionText, 'is-hinted');
  }

  private setCaption(text: string, withRemove: boolean): void {
    this.captionText.textContent = text;
    this.captionRemove.hidden = !withRemove;
  }

  private flashMessage(text: string): void {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.setCaption(text, false);
    this.messageTimer = setTimeout(() => {
      this.messageTimer = null;
      if (this.selected === null) this.showHint();
    }, MESSAGE_MS);
  }

  private animate(node: HTMLElement | undefined, className: string): void {
    if (!node) return;
    node.classList.remove(className);
    // Перезапуск анимации: принудительная перерисовка между снятием и установкой класса
    void node.offsetWidth;
    node.classList.add(className);
    node.addEventListener('animationend', () => node.classList.remove(className), { once: true });
  }
}
