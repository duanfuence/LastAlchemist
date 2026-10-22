import { describe, expect, it } from 'vitest';
import {
  BoardModel,
  MAX_BOARD_ITEMS,
  clampToBoard,
  findDropTarget,
  findFreeSpot,
} from '../../src/core/board/board';

const geometry = { width: 400, height: 300, itemSize: 60 };

describe('BoardModel', () => {
  it('добавляет, перемещает и убирает элементы', () => {
    const board = new BoardModel();
    const a = board.add('water', 0.2, 0.3);
    const b = board.add('fire', 0.6, 0.6);
    expect(board.all).toHaveLength(2);
    board.move(a!.uid, 0.5, 0.5);
    expect(board.get(a!.uid)).toMatchObject({ x: 0.5, y: 0.5 });
    board.remove(b!.uid);
    expect(board.all.map((i) => i.elementId)).toEqual(['water']);
  });

  it('ограничивает координаты полем', () => {
    const board = new BoardModel();
    const item = board.add('water', -1, 3);
    expect(item).toMatchObject({ x: 0, y: 1 });
  });

  it('поднимает перемещённый элемент наверх', () => {
    const board = new BoardModel();
    const a = board.add('water', 0.1, 0.1)!;
    board.add('fire', 0.2, 0.2);
    board.bringToFront(a.uid);
    expect(board.all.at(-1)?.uid).toBe(a.uid);
  });

  it('не принимает больше предела', () => {
    const board = new BoardModel();
    for (let i = 0; i < MAX_BOARD_ITEMS; i += 1) board.add('water', 0.5, 0.5);
    expect(board.add('water', 0.5, 0.5)).toBeUndefined();
    expect(board.isFull).toBe(true);
  });

  it('восстанавливает только разрешённые элементы', () => {
    const board = new BoardModel();
    board.restore(
      [
        { id: 'water', x: 0.1, y: 0.1 },
        { id: 'ghost', x: 0.2, y: 0.2 },
      ],
      (id) => id !== 'ghost',
    );
    expect(board.snapshot()).toEqual([{ id: 'water', x: 0.1, y: 0.1 }]);
  });
});

describe('геометрия поля', () => {
  it('удерживает элемент целиком внутри поля', () => {
    expect(clampToBoard(0, 1, geometry)).toEqual({ x: 30 / 400, y: 1 - 30 / 300 });
  });

  it('находит свободное место, не перекрывающее другие элементы', () => {
    const items = [{ x: 0.5, y: 0.45 }];
    const spot = findFreeSpot(items, geometry);
    const distance = Math.hypot((spot.x - 0.5) * 400, (spot.y - 0.45) * 300);
    expect(distance).toBeGreaterThanOrEqual(geometry.itemSize);
  });

  it('свободное место детерминировано', () => {
    const items = [{ x: 0.5, y: 0.45 }, { x: 0.6, y: 0.45 }];
    expect(findFreeSpot(items, geometry)).toEqual(findFreeSpot(items, geometry));
  });

  it('находит цель сброса и игнорирует сам переносимый элемент', () => {
    const board = new BoardModel();
    const a = board.add('water', 0.5, 0.5)!;
    const b = board.add('fire', 0.8, 0.5)!;
    expect(findDropTarget(board.all, { x: 0.52, y: 0.5 }, geometry)?.uid).toBe(a.uid);
    expect(findDropTarget(board.all, { x: 0.5, y: 0.5 }, geometry, a.uid)).toBeUndefined();
    expect(findDropTarget(board.all, { x: 0.79, y: 0.52 }, geometry, a.uid)?.uid).toBe(b.uid);
  });
});
