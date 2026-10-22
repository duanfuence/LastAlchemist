/**
 * Перетаскивание на Pointer Events: одна реализация для мыши, касаний и пера.
 * Нажатия (без перемещения) сюда не попадают — их обрабатывает обычный click,
 * который работает и с клавиатуры. После перетаскивания ложный click подавляется.
 */

export interface DragCallbacks<S> {
  onStart(source: S, point: PointerPoint): void;
  onMove(source: S, point: PointerPoint): void;
  onDrop(source: S, point: PointerPoint): void;
  onCancel(source: S): void;
}

export interface PointerPoint {
  clientX: number;
  clientY: number;
  /** Смещение указателя от центра элемента в момент захвата. */
  offsetX: number;
  offsetY: number;
}

/** Порог начала перетаскивания: мышь точнее пальца. */
const THRESHOLD = { mouse: 4, touch: 9, pen: 6 } as const;

interface Pending<S> {
  source: S;
  node: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  threshold: number;
  dragging: boolean;
}

export class DragController<S> {
  private active: Pending<S> | null = null;
  private suppressClick = false;

  constructor(private readonly callbacks: DragCallbacks<S>) {
    // Click после перетаскивания приходит на захвативший указатель элемент — гасим его
    document.addEventListener(
      'click',
      (event) => {
        if (!this.suppressClick) return;
        this.suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }

  get isDragging(): boolean {
    return this.active?.dragging ?? false;
  }

  bind(node: HTMLElement, source: () => S): void {
    node.addEventListener('pointerdown', (event) => this.down(event, node, source()));
    node.addEventListener('pointermove', (event) => this.move(event));
    node.addEventListener('pointerup', (event) => this.up(event));
    node.addEventListener('pointercancel', (event) => this.cancel(event));
    // На сенсорных экранах браузер сам захватывает касание на вложенном элементе (рисунке SVG).
    // Когда захват переходит к кнопке, вложенный элемент теряет его — это не отмена перетаскивания.
    node.addEventListener('lostpointercapture', (event) => {
      if (event.target === node) this.cancel(event);
    });
  }

  /** Прерывает текущее перетаскивание (например, при уходе со страницы). */
  abort(): void {
    if (this.active?.dragging) this.callbacks.onCancel(this.active.source);
    this.active = null;
  }

  private down(event: PointerEvent, node: HTMLElement, source: S): void {
    if (this.active) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Точка привязки — центр медальона (у элементов стола под ним ещё подпись)
    const anchor = node.querySelector<HTMLElement>('.medal') ?? node;
    const rect = anchor.getBoundingClientRect();
    const type = event.pointerType as keyof typeof THRESHOLD;
    this.active = {
      source,
      node,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - (rect.left + rect.width / 2),
      offsetY: event.clientY - (rect.top + rect.height / 2),
      threshold: THRESHOLD[type] ?? THRESHOLD.mouse,
      dragging: false,
    };
  }

  private move(event: PointerEvent): void {
    const active = this.active;
    if (!active || event.pointerId !== active.pointerId) return;
    if (!active.dragging) {
      const distance = Math.hypot(event.clientX - active.startX, event.clientY - active.startY);
      if (distance < active.threshold) return;
      active.dragging = true;
      try {
        active.node.setPointerCapture(event.pointerId);
      } catch {
        // Указатель уже отпущен — перетаскивание завершится в up/cancel
      }
      this.callbacks.onStart(active.source, this.point(event, active));
    }
    event.preventDefault();
    this.callbacks.onMove(active.source, this.point(event, active));
  }

  private up(event: PointerEvent): void {
    const active = this.active;
    if (!active || event.pointerId !== active.pointerId) return;
    this.active = null;
    if (!active.dragging) return;
    this.suppressClick = true;
    // Если click так и не придёт (указатель отпущен вне элемента), флаг не должен «повиснуть»
    setTimeout(() => {
      this.suppressClick = false;
    }, 0);
    this.callbacks.onDrop(active.source, this.point(event, active));
  }

  private cancel(event: PointerEvent): void {
    const active = this.active;
    if (!active || event.pointerId !== active.pointerId) return;
    // lostpointercapture приходит и после обычного pointerup — к этому моменту active уже сброшен
    this.active = null;
    if (active.dragging) this.callbacks.onCancel(active.source);
  }

  private point(event: PointerEvent, active: Pending<S>): PointerPoint {
    return { clientX: event.clientX, clientY: event.clientY, offsetX: active.offsetX, offsetY: active.offsetY };
  }
}
