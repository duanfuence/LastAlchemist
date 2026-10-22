import {
  clampToBoard,
  findDropTarget,
  findFreeSpot,
  type BoardGeometry,
  type BoardItem,
} from '../../core/board/board';
import type { CombineReport, CombineSource, GameSession } from '../../game/GameSession';
import type { Translator } from '../../i18n';
import { uiArt } from '../art';
import { el } from '../dom';
import { ScrollEdgeWatcher } from '../scrollEdges';
import { DragController, type PointerPoint } from './DragController';
import { medal } from './medal';
import { Toast } from './Toast';

type DragSource = { kind: 'catalog'; elementId: string } | { kind: 'board'; uid: number };

export interface LabDeps {
  session: GameSession;
  i18n: Translator;
  onExit(): void;
}

/** Длительность исчезновения соединяемых элементов (согласована с CSS). */
const MERGE_MS = 200;
/** Сколько держится сообщение о неудаче или открытии, прежде чем вернуть подсказку. */
const MESSAGE_MS = 4000;

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Лаборатория: список открытых элементов, рабочий стол, верхняя панель.
 * Вся игровая логика — в GameSession; здесь только отображение и ввод.
 */
export class LabView {
  readonly root: HTMLElement;
  readonly bar: HTMLElement;

  private readonly session: GameSession;
  private readonly i18n: Translator;
  private readonly board: HTMLElement;
  private readonly itemsLayer: HTMLElement;
  private readonly catalog: HTMLElement;
  private readonly catalogScroll: HTMLElement;
  private readonly catalogList: HTMLElement;
  private readonly catalogToggle: HTMLButtonElement;
  private readonly catalogCount: HTMLElement;
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
    this.i18n = deps.i18n;
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
    this.bar = el('header', { className: 'desk-bar' }, [
      back,
      el('p', { className: 'desk-bar__title', text: t('app.title') }),
      this.counter,
      clear,
    ]);

    // Список элементов
    this.catalogCount = el('span', { className: 'catalog__count' });
    this.catalogToggle = el('button', {
      className: 'catalog__toggle',
      attrs: { type: 'button', 'aria-expanded': 'false', 'data-testid': 'catalog-toggle' },
    });
    this.catalogToggle.addEventListener('click', () => this.toggleCatalog());
    this.catalogList = el('ul', { className: 'catalog__list' });
    this.catalogScroll = el('div', { className: 'catalog__scroll' }, [this.catalogList]);
    this.catalog = el('aside', { className: 'catalog', attrs: { 'data-testid': 'catalog' } }, [
      el('div', { className: 'catalog__head' }, [
        el('h2', { className: 'catalog__title', text: t('lab.catalogTitle') }),
        this.catalogCount,
        this.catalogToggle,
      ]),
      this.catalogScroll,
    ]);
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
    this.board = el('div', {
      className: 'board',
      attrs: { role: 'group', 'aria-label': t('lab.boardLabel'), 'data-testid': 'board' },
    }, [
      uiArt('emblem', 'board__emblem'),
      this.itemsLayer,
      this.toast.root,
      el('div', { className: 'board__caption', attrs: { 'aria-live': 'polite' } }, [this.captionText, this.captionRemove]),
    ]);
    // Касание пустого места снимает выделение
    this.board.addEventListener('click', (event) => {
      if (event.target === this.board || event.target === this.itemsLayer) this.select(null);
    });

    this.root = el('section', { className: 'lab', attrs: { 'data-screen': 'lab' } }, [this.catalog, this.board]);
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.select(null);
    });

    this.drag = new DragController<DragSource>({
      onStart: (source, point) => this.dragStart(source, point),
      onMove: (source, point) => this.dragMove(source, point),
      onDrop: (source, point) => this.dragDrop(source, point),
      onCancel: (source) => this.dragCancel(source),
    });

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
        // Порядок открытия: в свёрнутой ленте свежие элементы показываются первыми
        entry.style.setProperty('--recent', String(progress.discovered.indexOf(id)));
        items.push(entry);
      }
    }
    this.catalogList.replaceChildren(...items);
    this.updateCatalogLabels();
    this.updateCatalogToggle();
  }

  private catalogItem(elementId: string): HTMLButtonElement {
    const name = this.i18n.element(elementId).name;
    const button = el('button', {
      className: `catalog-item${this.fresh.has(elementId) ? ' is-fresh' : ''}`,
      attrs: { type: 'button', 'data-element': elementId, 'data-testid': `catalog-${elementId}` },
    }, [medal(this.session.content, elementId), el('span', { className: 'catalog-item__name', text: name })]);
    button.addEventListener('click', () => this.activateCatalog(elementId));
    this.drag.bind(button, () => ({ kind: 'catalog', elementId }));
    return button;
  }

  private updateCatalogLabels(): void {
    const key = this.selected === null ? 'lab.catalogItemLabel' : 'lab.catalogItemCombineLabel';
    for (const button of this.catalogList.querySelectorAll<HTMLButtonElement>('.catalog-item')) {
      const id = button.dataset['element'] ?? '';
      button.setAttribute('aria-label', this.i18n.t(key, { name: this.i18n.element(id).name }));
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
    return findFreeSpot(this.session.board.all, this.geometry(true), near);
  }

  // ---------- Нажатия и клавиатура ----------

  private activateCatalog(elementId: string): void {
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
    if (uid === null) {
      this.showHint();
      return;
    }
    const item = this.session.board.get(uid);
    if (!item) return;
    const text = this.i18n.element(item.elementId);
    this.setCaption(`${text.name}. ${text.description} ${this.i18n.t('lab.hintSelected')}`, true);
  }

  // ---------- Перетаскивание ----------

  private dragStart(source: DragSource, point: PointerPoint): void {
    this.select(null);
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
    this.showHint();
  }

  /**
   * Соединение. firstDrop — точка, куда отпущен переносимый элемент:
   * при неудаче он остаётся рядом с целью, не перекрывая её.
   */
  private combine(first: CombineSource, second: CombineSource, firstDrop?: { x: number; y: number }): void {
    const report = this.session.combine(first, second);
    this.select(null);
    if (!report) return;
    const { outcome } = report;

    if (outcome.kind === 'no-recipe' || outcome.kind === 'invalid') {
      this.rejected(report, first, second, firstDrop);
      return;
    }

    // Участники исчезают на месте цели, затем появляется результат
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

    this.renderBoard();
    this.renderCounter();
    this.renderCatalog();
    // Новое открытие должно быть видно в начале ленты и списка
    if (outcome.kind === 'discovery') this.catalogScroll.scrollTo({ left: 0 });
    const resultNode = report.result ? this.itemNodes.get(report.result.uid) : undefined;
    this.animate(resultNode, outcome.kind === 'discovery' ? 'is-discovery' : 'is-born');
    if (outcome.kind === 'discovery') this.animate(this.counter, 'is-bumped');

    const label = this.i18n.t(
      outcome.kind === 'discovery' ? 'lab.discovery' : outcome.kind === 'new-recipe' ? 'lab.newRecipe' : 'lab.known',
    );
    const text = this.i18n.element(outcome.element);
    this.toast.show(outcome.kind, label, text.name, medal(this.session.content, outcome.element));
    this.flashMessage(`${text.name}. ${text.description}`);
  }

  private rejected(
    report: CombineReport,
    first: CombineSource,
    second: CombineSource,
    firstDrop?: { x: number; y: number },
  ): void {
    // Переносимый элемент не должен остаться поверх цели
    if (firstDrop && 'uid' in second) {
      const target = this.session.board.get(second.uid);
      const others = this.session.board.all.filter((item) => !('uid' in first) || item.uid !== first.uid);
      const spot = findFreeSpot(others, this.geometry(true), target ? { x: target.x, y: target.y } : firstDrop);
      if ('uid' in first) {
        this.session.move(first.uid, spot.x, spot.y);
      } else {
        const placed = this.session.place(first.elementId, spot.x, spot.y);
        if (placed) this.useFresh(first.elementId);
      }
    }
    this.renderBoard();
    for (const source of [first, second]) {
      if ('uid' in source) this.animate(this.itemNodes.get(source.uid), 'is-rejected');
    }
    const name = (id: string): string => this.i18n.element(id).name;
    this.flashMessage(this.i18n.t('lab.noRecipe', { first: name(report.first), second: name(report.second) }));
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

  private toggleCatalog(): void {
    const expanded = this.catalog.toggleAttribute('data-expanded');
    this.updateCatalogToggle(expanded);
  }

  private updateCatalogToggle(expanded = this.catalog.hasAttribute('data-expanded')): void {
    this.catalogToggle.textContent = this.i18n.t(expanded ? 'lab.catalogCollapse' : 'lab.catalogExpand');
    this.catalogToggle.setAttribute('aria-expanded', String(expanded));
  }

  // ---------- Подписи и анимации ----------

  private showHint(): void {
    if (this.messageTimer) return;
    const empty = this.session.board.all.length === 0;
    this.setCaption(this.i18n.t(empty ? 'lab.hintEmpty' : 'lab.hintIdle'), false);
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
