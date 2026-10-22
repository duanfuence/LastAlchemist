/** Допуск в пикселях: дробные размеры не должны давать ложное «есть продолжение». */
const EDGE_TOLERANCE = 2;

export interface ScrollEdges {
  moreAbove: boolean;
  moreBelow: boolean;
}

export function measureScrollEdges(metrics: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): ScrollEdges {
  const { scrollTop, scrollHeight, clientHeight } = metrics;
  return {
    moreAbove: scrollTop > EDGE_TOLERANCE,
    moreBelow: scrollHeight - clientHeight - scrollTop > EDGE_TOLERANCE,
  };
}

/**
 * Следит, есть ли содержимое выше и ниже видимой части прокручиваемой области,
 * и отражает это атрибутами data-more-above / data-more-below на элементе target.
 * Пересчёт — при прокрутке, изменении размеров (поворот экрана) и смене содержимого.
 */
export class ScrollEdgeWatcher {
  private readonly resizeObserver: ResizeObserver;
  private readonly listeners = new Set<(edges: ScrollEdges) => void>();
  private observedContent: Element[] = [];
  private frame = 0;

  constructor(
    private readonly scroller: HTMLElement,
    private readonly target: HTMLElement,
  ) {
    this.resizeObserver = new ResizeObserver(() => this.schedule());
    this.resizeObserver.observe(scroller);
    scroller.addEventListener('scroll', () => this.schedule(), { passive: true });
  }

  /** Вызывать после замены содержимого: новый дочерний элемент тоже отслеживается по размеру. */
  contentChanged(): void {
    for (const old of this.observedContent) this.resizeObserver.unobserve(old);
    this.observedContent = Array.from(this.scroller.children);
    for (const child of this.observedContent) this.resizeObserver.observe(child);
    this.update();
  }

  onChange(listener: (edges: ScrollEdges) => void): void {
    this.listeners.add(listener);
  }

  update(): void {
    const edges = measureScrollEdges(this.scroller);
    this.target.toggleAttribute('data-more-above', edges.moreAbove);
    this.target.toggleAttribute('data-more-below', edges.moreBelow);
    for (const listener of this.listeners) listener(edges);
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  }
}
