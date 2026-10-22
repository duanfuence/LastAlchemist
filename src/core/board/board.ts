/**
 * Рабочее поле. Координаты центров нормированы к размеру поля (0..1),
 * поэтому раскладка сохраняется при повороте экрана и смене размера окна.
 */

export interface BoardItem {
  readonly uid: number;
  readonly elementId: string;
  readonly x: number;
  readonly y: number;
}

export interface BoardSnapshotItem {
  id: string;
  x: number;
  y: number;
}

export interface BoardGeometry {
  /** Размер поля в пикселях. */
  width: number;
  height: number;
  /** Диаметр элемента на поле в пикселях. */
  itemSize: number;
}

/** Предел элементов на поле: защищает от бесконечного наполнения и разрастания сохранения. */
export const MAX_BOARD_ITEMS = 60;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export class BoardModel {
  private items: BoardItem[] = [];
  private nextUid = 1;

  get all(): readonly BoardItem[] {
    return this.items;
  }

  get isFull(): boolean {
    return this.items.length >= MAX_BOARD_ITEMS;
  }

  get(uid: number): BoardItem | undefined {
    return this.items.find((item) => item.uid === uid);
  }

  add(elementId: string, x: number, y: number): BoardItem | undefined {
    if (this.isFull) return undefined;
    const item: BoardItem = { uid: this.nextUid++, elementId, x: clamp01(x), y: clamp01(y) };
    this.items.push(item);
    return item;
  }

  move(uid: number, x: number, y: number): void {
    this.items = this.items.map((item) => (item.uid === uid ? { ...item, x: clamp01(x), y: clamp01(y) } : item));
  }

  /** Поднимает элемент наверх (последний в списке рисуется поверх остальных). */
  bringToFront(uid: number): void {
    const item = this.get(uid);
    if (!item) return;
    this.items = [...this.items.filter((i) => i.uid !== uid), item];
  }

  remove(uid: number): void {
    this.items = this.items.filter((item) => item.uid !== uid);
  }

  clear(): void {
    this.items = [];
  }

  snapshot(): BoardSnapshotItem[] {
    return this.items.map(({ elementId, x, y }) => ({ id: elementId, x, y }));
  }

  restore(items: readonly BoardSnapshotItem[], isAllowed: (id: string) => boolean): void {
    this.clear();
    for (const item of items.slice(0, MAX_BOARD_ITEMS)) {
      if (isAllowed(item.id)) this.add(item.id, item.x, item.y);
    }
  }
}

/** Нормированные границы центра, при которых элемент целиком остаётся на поле. */
export function clampToBoard(x: number, y: number, geometry: BoardGeometry): { x: number; y: number } {
  const rx = geometry.width > 0 ? Math.min(0.5, geometry.itemSize / 2 / geometry.width) : 0.5;
  const ry = geometry.height > 0 ? Math.min(0.5, geometry.itemSize / 2 / geometry.height) : 0.5;
  return { x: Math.min(1 - rx, Math.max(rx, x)), y: Math.min(1 - ry, Math.max(ry, y)) };
}

/**
 * Свободное место для нового элемента: ближайшая к точке preferred позиция,
 * не перекрывающая другие элементы. Поиск детерминирован (спираль от точки).
 */
export function findFreeSpot(
  items: readonly Pick<BoardItem, 'x' | 'y'>[],
  geometry: BoardGeometry,
  preferred: { x: number; y: number } = { x: 0.5, y: 0.45 },
): { x: number; y: number } {
  const { width, height, itemSize } = geometry;
  if (width <= 0 || height <= 0) return preferred;
  const minDistance = itemSize * 1.05;
  const isFree = (x: number, y: number): boolean =>
    items.every((item) => Math.hypot((item.x - x) * width, (item.y - y) * height) >= minDistance);

  const clearance = (x: number, y: number): number =>
    items.reduce((min, item) => Math.min(min, Math.hypot((item.x - x) * width, (item.y - y) * height)), Infinity);

  const start = clampToBoard(preferred.x, preferred.y, geometry);
  if (isFree(start.x, start.y)) return start;
  // Если свободного места нет, кладём туда, где просторнее всего, а не стопкой в одну точку
  let best = start;
  let bestClearance = clearance(start.x, start.y);
  const step = itemSize * 0.6;
  for (let ring = 1; ring <= 40; ring += 1) {
    const radius = ring * step;
    const points = Math.max(6, Math.round((2 * Math.PI * radius) / step));
    for (let i = 0; i < points; i += 1) {
      const angle = (i / points) * 2 * Math.PI;
      const spot = clampToBoard(
        start.x + (Math.cos(angle) * radius) / width,
        start.y + (Math.sin(angle) * radius) / height,
        geometry,
      );
      if (isFree(spot.x, spot.y)) return spot;
      const room = clearance(spot.x, spot.y);
      if (room > bestClearance) {
        best = spot;
        bestClearance = room;
      }
    }
  }
  return best;
}

/** Элемент под точкой сброса: ближайший центр в пределах радиуса совпадения. */
export function findDropTarget(
  items: readonly BoardItem[],
  point: { x: number; y: number },
  geometry: BoardGeometry,
  excludeUid?: number,
): BoardItem | undefined {
  const radius = geometry.itemSize * 0.7;
  let best: BoardItem | undefined;
  let bestDistance = Infinity;
  for (const item of items) {
    if (item.uid === excludeUid) continue;
    const distance = Math.hypot((item.x - point.x) * geometry.width, (item.y - point.y) * geometry.height);
    if (distance <= radius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}
