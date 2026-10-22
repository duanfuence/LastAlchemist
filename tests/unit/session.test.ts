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
});

/** Кладёт оба элемента на стол и соединяет их. */
function combineOnBoard(session: GameSession, first: string, second: string) {
  const a = session.place(first, 0.2, 0.2)!;
  const b = session.place(second, 0.7, 0.7)!;
  return session.combine({ uid: a.uid }, { uid: b.uid })!;
}

const onBoard = (session: GameSession, id: string): number =>
  session.board.all.filter((item) => item.elementId === id).length;

describe('повторное получение уже открытого результата', () => {
  it('новое открытие расходует обоих участников и кладёт результат на место цели', () => {
    const { session } = newSession();
    const report = combineOnBoard(session, 'air', 'earth');
    expect(report.outcome).toMatchObject({ kind: 'discovery', element: 'dust' });
    expect(report.consumed).toHaveLength(2);
    expect(report.result).toMatchObject({ elementId: 'dust', x: 0.7, y: 0.7 });
    expect(session.board.snapshot()).toEqual([{ id: 'dust', x: 0.7, y: 0.7 }]);
  });

  it('известный рецепт: оба участника остаются на прежних местах, результата нет', () => {
    const { session } = newSession();
    combineOnBoard(session, 'air', 'earth');
    const recipesBefore = [...session.progress.recipes];
    const earth = session.place('earth', 0.15, 0.25)!;
    const air = session.place('air', 0.8, 0.6)!;
    const boardBefore = session.board.snapshot();

    const report = session.combine({ uid: earth.uid }, { uid: air.uid })!;
    expect(report.outcome).toMatchObject({ kind: 'known', element: 'dust' });
    expect(report.result).toBeUndefined();
    expect(report.consumed).toEqual([]);
    // Стол не изменился: те же элементы на тех же местах, второго экземпляра результата нет
    expect(session.board.snapshot()).toEqual(boardBefore);
    expect(session.board.get(earth.uid)).toMatchObject({ x: 0.15, y: 0.25 });
    expect(session.board.get(air.uid)).toMatchObject({ x: 0.8, y: 0.6 });
    expect(onBoard(session, 'dust')).toBe(1);
    expect(session.progress.recipes).toEqual(recipesBefore);
    expect(session.counts.found).toBe(1);
  });

  it('альтернативный рецепт: участники остаются, рецепт записывается, результата нет', () => {
    const { session } = newSession();
    combineOnBoard(session, 'air', 'water'); // Дождь — первый рецепт
    combineOnBoard(session, 'water', 'fire'); // Пар
    combineOnBoard(session, 'steam', 'air'); // Облако
    session.clearBoard();
    const found = session.counts.found;

    const cloud = session.place('cloud', 0.3, 0.3)!;
    const water = session.place('water', 0.6, 0.4)!;
    const report = session.combine({ uid: cloud.uid }, { uid: water.uid })!;
    expect(report.outcome).toMatchObject({ kind: 'new-recipe', element: 'rain' });
    expect(report.result).toBeUndefined();
    expect(report.consumed).toEqual([]);
    expect(session.board.snapshot()).toEqual([
      { id: 'cloud', x: 0.3, y: 0.3 },
      { id: 'water', x: 0.6, y: 0.4 },
    ]);
    expect(session.progress.recipes).toContain('cloud|water');
    expect(session.progress.discovered.filter((id) => id === 'rain')).toHaveLength(1);
    expect(session.counts.found).toBe(found);

    // Тот же альтернативный рецепт второй раз — уже известен, и участники снова остаются
    const again = session.combine({ uid: water.uid }, { uid: cloud.uid })!;
    expect(again.outcome.kind).toBe('known');
    expect(session.board.all).toHaveLength(2);
  });

  it('после повтора с теми же элементами сразу можно продолжить опыты', () => {
    const { session } = newSession();
    combineOnBoard(session, 'water', 'fire'); // Пар
    const water = session.place('water', 0.2, 0.2)!;
    const fire = session.place('fire', 0.5, 0.5)!;
    const earth = session.place('earth', 0.8, 0.8)!;
    expect(session.combine({ uid: water.uid }, { uid: fire.uid })!.outcome.kind).toBe('known');
    // Та же Вода сразу участвует в новом открытии
    const next = session.combine({ uid: water.uid }, { uid: earth.uid })!;
    expect(next.outcome).toMatchObject({ kind: 'discovery', element: 'mud' });
    expect(next.consumed.sort()).toEqual([water.uid, earth.uid].sort());
    expect(session.board.get(fire.uid)).toMatchObject({ elementId: 'fire', x: 0.5, y: 0.5 });
  });

  it('повторное получение известным рецептом не мешает потом записать альтернативный', () => {
    const { session } = newSession();
    // Сначала Дождь через Облако, затем дважды через Воздух + Воду
    combineOnBoard(session, 'water', 'fire');
    combineOnBoard(session, 'steam', 'air');
    expect(combineOnBoard(session, 'cloud', 'water').outcome.kind).toBe('discovery');
    expect(combineOnBoard(session, 'air', 'water').outcome.kind).toBe('new-recipe');
    expect(combineOnBoard(session, 'water', 'air').outcome.kind).toBe('known');
    expect(session.progress.recipes).toEqual(expect.arrayContaining(['cloud|water', 'air|water']));
  });

  it('известный элемент снова доступен из списка и участвует в других соединениях', () => {
    const { session } = newSession();
    combineOnBoard(session, 'air', 'water');
    combineOnBoard(session, 'air', 'water'); // повтор: Дождь на стол не кладётся
    session.clearBoard();
    const report = combineOnBoard(session, 'rain', 'earth');
    expect(report.outcome).toMatchObject({ kind: 'discovery', element: 'plant' });
  });

  it('элементы из списка не расходуются, начальные доступны всегда', () => {
    const { session } = newSession();
    for (let i = 0; i < 10; i += 1) {
      const report = session.combine({ elementId: 'water' }, { elementId: 'fire' })!;
      expect(report.consumed).toEqual([]);
    }
    expect(onBoard(session, 'steam')).toBe(1);
    for (const id of content.startingIds) expect(session.place(id, 0.5, 0.5), id).toBeDefined();
  });

  it('элемент из списка и известный результат: элемент на столе остаётся', () => {
    const { session } = newSession();
    session.combine({ elementId: 'water' }, { elementId: 'fire' }); // Пар
    const fire = session.place('fire', 0.4, 0.4)!;
    const report = session.combine({ elementId: 'water' }, { uid: fire.uid })!;
    expect(report.outcome.kind).toBe('known');
    expect(report.consumed).toEqual([]);
    expect(session.board.get(fire.uid)).toMatchObject({ elementId: 'fire', x: 0.4, y: 0.4 });
  });

  it('каждый рецепт базы: первое получение, затем повтор — участники на месте, второго экземпляра нет', () => {
    const { session } = newSession();
    const pending = [...content.recipes];
    // Рецепты применяются по мере доступности входов, пока не будут пройдены все
    while (pending.length > 0) {
      const index = pending.findIndex((r) => r.inputs.every((id) => session.isDiscovered(id)));
      expect(index, `недоступные рецепты: ${pending.map((r) => r.key).join(', ')}`).toBeGreaterThanOrEqual(0);
      const [recipe] = pending.splice(index, 1);
      const known = session.isDiscovered(recipe!.output);
      session.clearBoard();

      const first = combineOnBoard(session, recipe!.inputs[0], recipe!.inputs[1]);
      expect(first.outcome.kind, recipe!.key).toBe(known ? 'new-recipe' : 'discovery');
      expect(onBoard(session, recipe!.output), recipe!.key).toBe(known ? 0 : 1);
      expect(session.progress.recipes, recipe!.key).toContain(recipe!.key);
      // Альтернативный рецепт не расходует участников
      expect(session.board.all, recipe!.key).toHaveLength(known ? 2 : 1);

      session.clearBoard();
      const again = combineOnBoard(session, recipe!.inputs[1], recipe!.inputs[0]);
      expect(again.outcome.kind, recipe!.key).toBe('known');
      expect(again.consumed, recipe!.key).toEqual([]);
      expect(session.board.all, `${recipe!.key}: участники на месте`).toHaveLength(2);
      expect(onBoard(session, recipe!.output), `${recipe!.key}: второй экземпляр`).toBe(
        recipe!.inputs.includes(recipe!.output) ? 1 : 0,
      );
    }
    expect([...session.progress.recipes].sort()).toEqual(content.recipes.map((r) => r.key).sort());
    expect(session.progress.discovered).toHaveLength(content.elements.size);
  });

  it('после перезагрузки найденные рецепты известны, лишних экземпляров нет', () => {
    const { session, storage } = newSession();
    combineOnBoard(session, 'air', 'water');
    combineOnBoard(session, 'water', 'fire');
    combineOnBoard(session, 'steam', 'air');
    combineOnBoard(session, 'cloud', 'water'); // альтернативный рецепт Дождя: участники остаются
    combineOnBoard(session, 'air', 'water'); // повтор: участники остаются
    session.flush();
    const boardBefore = session.board.snapshot();

    const reloaded = new GameSession(content, new LocalSaveStore(storage, 0));
    expect(reloaded.board.snapshot()).toEqual(boardBefore);
    expect(reloaded.board.all.filter((i) => i.elementId === 'rain')).toHaveLength(1);
    expect(reloaded.progress.recipes).toEqual(expect.arrayContaining(['air|water', 'cloud|water']));
    expect(combineOnBoard(reloaded, 'cloud', 'water').outcome.kind).toBe('known');
    expect(combineOnBoard(reloaded, 'water', 'air').outcome.kind).toBe('known');
    expect(reloaded.counts.found).toBe(session.counts.found);
  });

  it('неудачное соединение ничего не меняет', () => {
    const { session } = newSession();
    const a = session.place('fire', 0.2, 0.2)!;
    const b = session.place('fire', 0.6, 0.2)!;
    const report = session.combine({ uid: a.uid }, { uid: b.uid })!;
    expect(report.outcome.kind).toBe('no-recipe');
    expect(report.consumed).toEqual([]);
    expect(session.board.snapshot()).toEqual([
      { id: 'fire', x: 0.2, y: 0.2 },
      { id: 'fire', x: 0.6, y: 0.2 },
    ]);
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
