import { describe, expect, it } from 'vitest';
import { readContentFromDisk } from '../../tools/lib/read-content';
import { GameSession } from '../../src/game/GameSession';
import { reachedStory } from '../../src/core/progress/story';
import { LocalSaveStore, SAVE_KEY, type StorageLike } from '../../src/persistence/LocalSaveStore';

const content = readContentFromDisk().assembled.pack;
const all = [...content.elements.keys()];
const regular = all.filter((id) => !content.elements.get(id)!.secret);

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function sessionWith(discovered: string[], extra: Record<string, unknown> = {}) {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ v: 1, savedAt: 1, discovered, recipes: [], board: [], ...extra }));
  return { storage, session: new GameSession(content, new LocalSaveStore(storage, 0)) };
}

const reload = (storage: MemoryStorage) => new GameSession(content, new LocalSaveStore(storage, 0));
/** Соединение из списка с элементом на столе (оба — открытые элементы). */
const combine = (session: GameSession, a: string, b: string) => session.combine({ elementId: a }, { uid: session.place(b, 0.5, 0.5)!.uid })!;

describe('сюжетные записи', () => {
  it('условия: запись об исследовании — все обычные; финал — ещё и тайный', () => {
    expect(reachedStory(content, { discovered: regular.filter((id) => id !== 'salt'), recipes: [] })).toEqual([]);
    expect(reachedStory(content, { discovered: regular, recipes: [] })).toEqual(['research']);
    expect(reachedStory(content, { discovered: all, recipes: [] })).toEqual(['research', 'final']);
    // Тайный найден раньше всей книги — финала ещё нет
    expect(reachedStory(content, { discovered: all.filter((id) => id !== 'salt'), recipes: [] })).toEqual([]);
  });

  it('последний обычный элемент вызывает запись об исследовании ровно один раз', () => {
    const { session, storage } = sessionWith(regular.filter((id) => id !== 'cinnabar'));
    expect(session.story).toEqual([]);
    const report = combine(session, 'mercury', 'sulfur');
    expect(report.outcome.kind).toBe('discovery');
    expect(report.story).toEqual(['research']);
    expect(session.story).toEqual(['research']);
    // Повтор рецепта не вызывает запись снова
    expect(combine(session, 'mercury', 'sulfur').story).toEqual([]);
    session.flush();
    expect((JSON.parse(storage.getItem(SAVE_KEY)!) as { story: string[] }).story).toEqual(['research']);
    // Перезагрузка: запись помнится, но не наступает заново
    const again = reload(storage);
    expect(again.story).toEqual(['research']);
    expect(combine(again, 'water', 'fire').story).toEqual([]);
  });

  it('Гомункул после всей книги вызывает финал один раз', () => {
    const { session, storage } = sessionWith(regular, { story: ['research'] });
    const report = combine(session, 'life', 'mercury');
    expect(report.outcome).toMatchObject({ kind: 'discovery', element: 'homunculus' });
    expect(report.story).toEqual(['final']);
    expect(combine(session, 'life', 'mercury').story).toEqual([]);
    session.flush();
    expect(reload(storage).story).toEqual(['research', 'final']);
  });

  it('Гомункул найден раньше всей книги: финал наступает вместе с последним обычным опытом', () => {
    const { session } = sessionWith(all.filter((id) => id !== 'cinnabar'));
    expect(session.story).toEqual([]);
    expect(combine(session, 'mercury', 'sulfur').story).toEqual(['research', 'final']);
  });

  it('сохранение прежней версии с заполненной книгой: записи доступны, но не наступают как новые', () => {
    const { session, storage } = sessionWith(all);
    expect(session.story).toEqual(['research', 'final']);
    expect(combine(session, 'life', 'mercury').story).toEqual([]);
    // Без действий игрока запись не переписывается
    expect(storage.getItem(SAVE_KEY)).not.toContain('"story"');
  });

  it('незнакомые записи из более новой версии сохраняются', () => {
    const { session, storage } = sessionWith(regular.filter((id) => id !== 'cinnabar'), { story: ['epilogue'] });
    combine(session, 'mercury', 'sulfur');
    session.flush();
    expect((JSON.parse(storage.getItem(SAVE_KEY)!) as { story: string[] }).story).toEqual(['research', 'epilogue']);
  });
});
