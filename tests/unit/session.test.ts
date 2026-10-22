import { describe, expect, it, vi } from 'vitest';
import { readContentFromDisk } from '../../tools/lib/read-content';
import { GameSession } from '../../src/game/GameSession';
import { BACKUP_KEY, LocalSaveStore, SAVE_KEY, type StorageLike } from '../../src/persistence/LocalSaveStore';

const content = readContentFromDisk().assembled.pack;

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const newSession = (storage = new MemoryStorage()) => {
  const store = new LocalSaveStore(storage, 0);
  return { session: new GameSession(content, store), storage, store };
};

describe('GameSession на настоящей базе', () => {
  it('Вода + Огонь на столе дают Пар на месте цели, участники расходуются', () => {
    const { session } = newSession();
    const water = session.place('water', 0.2, 0.2)!;
    const fire = session.place('fire', 0.7, 0.6)!;
    const report = session.combine({ uid: water.uid }, { uid: fire.uid })!;
    expect(report.outcome).toMatchObject({ kind: 'discovery', element: 'steam' });
    expect(report.consumed.sort()).toEqual([water.uid, fire.uid].sort());
    expect(session.board.all).toHaveLength(1);
    expect(session.board.all[0]).toMatchObject({ elementId: 'steam', x: 0.7, y: 0.6 });
    expect(session.counts.found).toBe(1);
  });

  it('элемент из списка соединяется с элементом на столе', () => {
    const { session } = newSession();
    const fire = session.place('fire', 0.5, 0.5)!;
    const report = session.combine({ elementId: 'water' }, { uid: fire.uid })!;
    expect(report.outcome.kind).toBe('discovery');
    expect(report.consumed).toEqual([fire.uid]);
  });

  it('повторное получение не увеличивает счётчик', () => {
    const { session } = newSession();
    session.combine({ elementId: 'water' }, { uid: session.place('fire', 0.5, 0.5)!.uid });
    const before = session.counts.found;
    const again = session.combine({ elementId: 'fire' }, { uid: session.place('water', 0.3, 0.3)!.uid })!;
    expect(again.outcome.kind).toBe('known');
    expect(session.counts.found).toBe(before);
  });

  it('неудачное соединение ничего не меняет', () => {
    const { session } = newSession();
    const a = session.place('fire', 0.2, 0.2)!;
    const b = session.place('fire', 0.6, 0.2)!;
    const report = session.combine({ uid: a.uid }, { uid: b.uid })!;
    expect(report.outcome.kind).toBe('no-recipe');
    expect(session.board.all).toHaveLength(2);
    expect(session.counts.found).toBe(0);
  });

  it('не соединяет элемент сам с собой и не размещает неоткрытое', () => {
    const { session } = newSession();
    const a = session.place('water', 0.2, 0.2)!;
    expect(session.combine({ uid: a.uid }, { uid: a.uid })).toBeUndefined();
    expect(session.place('steam', 0.5, 0.5)).toBeUndefined();
  });

  it('продолжает с сохранённого места после «перезагрузки»', () => {
    const { session, storage } = newSession();
    session.combine({ elementId: 'water' }, { uid: session.place('fire', 0.4, 0.4)!.uid });
    session.place('air', 0.8, 0.2);
    session.flush();

    const reloaded = new GameSession(content, new LocalSaveStore(storage, 0));
    expect(reloaded.loadStatus).toBe('ok');
    expect(reloaded.isDiscovered('steam')).toBe(true);
    expect(reloaded.counts.found).toBe(1);
    expect(reloaded.board.snapshot()).toEqual([
      { id: 'steam', x: 0.4, y: 0.4 },
      { id: 'air', x: 0.8, y: 0.2 },
    ]);
  });

  it('при повреждённом сохранении начинает новую книгу и сохраняет копию', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{"v":1,"discovered":');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = new GameSession(content, new LocalSaveStore(storage, 0));
    session.flush();
    expect(session.loadStatus).toBe('corrupted');
    expect(storage.getItem(BACKUP_KEY)).toBe('{"v":1,"discovered":');
    expect(JSON.parse(storage.getItem(SAVE_KEY)!)).toMatchObject({ v: 1, discovered: ['water', 'fire', 'earth', 'air'] });
    warn.mockRestore();
  });

  it('сообщает об изменениях подписчикам', () => {
    const { session } = newSession();
    const listener = vi.fn();
    session.onChange(listener);
    const item = session.place('water', 0.5, 0.5)!;
    session.move(item.uid, 0.1, 0.1);
    session.remove(item.uid);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
