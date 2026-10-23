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
    ['нулевая версия', JSON.stringify({ v: 0, discovered: [], recipes: [] })],
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

describe('сохранения других версий', () => {
  const newerRaw = JSON.stringify({
    v: SAVE_VERSION + 1,
    savedAt: 1,
    discovered: ['water', 'fire', 'earth', 'air', 'steam', 'philosophers_stone'],
    recipes: ['fire|water'],
    board: [{ id: 'steam', x: 0.3, y: 0.4 }],
    journal: { pages: 3 },
  });

  it('запись более новой версии не считается повреждённой: читается то, что понятно', () => {
    const result = parseSave(newerRaw, pack);
    expect(result.status).toBe('newer');
    expect(result.version).toBe(SAVE_VERSION + 1);
    expect(result.progress.discovered).toEqual(['water', 'fire', 'earth', 'air', 'steam']);
    expect(result.board).toEqual([{ id: 'steam', x: 0.3, y: 0.4 }]);
  });

  it('новая версия с незнакомой структурой — тоже «новая», а не повреждённая', () => {
    const result = parseSave(JSON.stringify({ v: SAVE_VERSION + 3, pages: [] }), pack);
    expect(result.status).toBe('newer');
    expect(result.progress.discovered).toEqual(['water', 'fire', 'earth', 'air']);
  });

  it('элементы, рецепты и поля из более новой базы переносятся в запись без изменений', () => {
    const raw = JSON.stringify({
      v: SAVE_VERSION,
      savedAt: 1,
      discovered: ['water', 'fire', 'earth', 'air', 'steam', 'philosophers_stone'],
      recipes: ['fire|water', 'gold|lead'],
      board: [],
      journal: { pages: 3 },
    });
    const result = parseSave(raw, pack);
    expect(result.status).toBe('ok');
    expect(result.progress.discovered).not.toContain('philosophers_stone');
    expect(result.preserved).toEqual({ discovered: ['philosophers_stone'], recipes: ['gold|lead'], fields: { journal: { pages: 3 } } });
    const saved = JSON.parse(serializeSave(result.progress, result.board, 2, result.preserved)) as Record<string, unknown>;
    expect(saved.discovered).toEqual(['water', 'fire', 'earth', 'air', 'steam', 'philosophers_stone']);
    expect(saved.recipes).toEqual(['fire|water', 'gold|lead']);
    expect(saved.journal).toEqual({ pages: 3 });
    expect(saved.v).toBe(SAVE_VERSION);
  });

  it('запись предыдущей версии переводится миграцией', () => {
    const format = {
      version: 2,
      migrations: { 1: (data: Record<string, unknown>) => ({ ...data, v: 2, discovered: data['found'], recipes: [] }) },
    };
    const raw = JSON.stringify({ v: 1, found: ['water', 'fire', 'earth', 'air', 'steam'], board: [] });
    const result = parseSave(raw, pack, format);
    expect(result.status).toBe('ok');
    expect(result.migratedFrom).toBe(1);
    expect(result.progress.discovered).toContain('steam');
  });

  it('сбой или отсутствие миграции — повреждённая запись, а не исключение', () => {
    const throwing = { version: 2, migrations: { 1: () => { throw new Error('плохие данные'); } } };
    const raw = JSON.stringify({ v: 1, discovered: [], recipes: [] });
    expect(parseSave(raw, pack, throwing).status).toBe('corrupted');
    expect(parseSave(raw, pack, { version: 3, migrations: {} }).status).toBe('corrupted');
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
    expect(new LocalSaveStore(storage).backup('{broken')).toBe(true);
    expect(storage.getItem(BACKUP_KEY)).toBe('{broken');
  });

  it('прежняя резервная копия не затирается другой', () => {
    const storage = new MemoryStorage();
    const store = new LocalSaveStore(storage);
    store.backup('{first', 1);
    store.backup('{first', 2);
    store.backup('{second', 3);
    expect(storage.getItem(BACKUP_KEY)).toBe('{first');
    expect(storage.getItem(`${BACKUP_KEY}:3`)).toBe('{second');
    expect(storage.data.size).toBe(2);
  });

  it('после lock() ничего не записывает', () => {
    const storage = new MemoryStorage();
    const store = new LocalSaveStore(storage, 0);
    store.schedule('x');
    store.lock();
    store.flush();
    store.schedule('y');
    store.flush();
    expect(store.readOnly).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});
