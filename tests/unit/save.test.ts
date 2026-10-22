import { describe, expect, it, vi } from 'vitest';
import { BACKUP_KEY, LocalSaveStore, SAVE_KEY, type StorageLike } from '../../src/persistence/LocalSaveStore';
import { SAVE_VERSION, parseSave, serializeSave } from '../../src/persistence/save';
import { BASIC_ELEMENTS, BASIC_RECIPES, makePack } from './helpers/content';

const pack = makePack(BASIC_ELEMENTS, BASIC_RECIPES);

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('parseSave', () => {
  it('без сохранения начинает новую книгу', () => {
    const result = parseSave(null, pack);
    expect(result.status).toBe('empty');
    expect(result.progress.discovered).toEqual(['water', 'fire', 'earth', 'air']);
  });

  it('читает сохранённый прогресс и стол', () => {
    const raw = serializeSave(
      { discovered: ['water', 'fire', 'earth', 'air', 'steam'], recipes: ['fire|water'] },
      [{ id: 'steam', x: 0.25, y: 0.5 }],
    );
    const result = parseSave(raw, pack);
    expect(result.status).toBe('ok');
    expect(result.progress.discovered).toContain('steam');
    expect(result.progress.recipes).toEqual(['fire|water']);
    expect(result.board).toEqual([{ id: 'steam', x: 0.25, y: 0.5 }]);
  });

  it.each([
    ['не JSON', '{oops'],
    ['не объект', '"строка"'],
    ['без версии', JSON.stringify({ discovered: [], recipes: [] })],
    ['будущая версия', JSON.stringify({ v: SAVE_VERSION + 1, discovered: [], recipes: [] })],
    ['без списков', JSON.stringify({ v: 1 })],
  ])('повреждённое сохранение (%s) не ломает игру', (_name, raw) => {
    const result = parseSave(raw, pack);
    expect(result.status).toBe('corrupted');
    expect(result.progress.discovered).toEqual(['water', 'fire', 'earth', 'air']);
    expect(result.board).toEqual([]);
  });

  it('отбрасывает неизвестные элементы и рецепты, восстанавливает начальные', () => {
    const raw = JSON.stringify({
      v: 1,
      discovered: ['steam', 'ghost', 42],
      recipes: ['fire|water', 'nope|nope'],
      board: [
        { id: 'steam', x: 0.5, y: 2 },
        { id: 'cloud', x: 0.1, y: 0.1 },
        { id: 'water', x: 'a', y: 0 },
      ],
    });
    const result = parseSave(raw, pack);
    expect(result.status).toBe('repaired');
    expect(result.progress.discovered).toEqual(['water', 'fire', 'earth', 'air', 'steam']);
    expect(result.progress.recipes).toEqual(['fire|water']);
    expect(result.board).toEqual([{ id: 'steam', x: 0.5, y: 1 }]);
  });
});

describe('LocalSaveStore', () => {
  it('объединяет частые изменения в одну отложенную запись', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const store = new LocalSaveStore(storage, 400);
    store.schedule('a');
    store.schedule('b');
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(storage.getItem(SAVE_KEY)).toBe('b');
    vi.useRealTimers();
  });

  it('flush записывает немедленно', () => {
    const storage = new MemoryStorage();
    const store = new LocalSaveStore(storage, 10_000);
    store.schedule('x');
    store.flush();
    expect(storage.getItem(SAVE_KEY)).toBe('x');
  });

  it('ошибка браузера при записи не прерывает игру и сообщается один раз', () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
    };
    const onFailure = vi.fn();
    const store = new LocalSaveStore(failing, 0, onFailure);
    store.schedule('x');
    store.flush();
    store.schedule('y');
    store.flush();
    expect(store.unavailable).toBe(true);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it('без хранилища работает в режиме «без сохранения»', () => {
    const store = new LocalSaveStore(null);
    expect(store.unavailable).toBe(true);
    expect(store.read()).toBeNull();
    expect(() => store.flush()).not.toThrow();
  });

  it('сохраняет резервную копию', () => {
    const storage = new MemoryStorage();
    new LocalSaveStore(storage).backup('{broken');
    expect(storage.getItem(BACKUP_KEY)).toBe('{broken');
  });
});
