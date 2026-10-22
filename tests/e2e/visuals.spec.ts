import type { Page, TestInfo } from '@playwright/test';
import { expect, press, test } from './fixtures';
import { SAVE_KEY, boardItems, openLab } from './game-helpers';

interface SeedSave {
  discovered: string[];
  recipes?: string[];
  board: { id: string; x: number; y: number }[];
}

/** Открывает лабораторию с заранее подготовленным сохранением. */
async function openWith(page: Page, testInfo: TestInfo, save: SeedSave): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify({ v: 1, savedAt: 1, recipes: [], ...save })] as const,
  );
  await openLab(page, testInfo);
}

const STARTING = ['water', 'fire', 'earth', 'air'];

async function combineOnBoard(page: Page, testInfo: TestInfo, first: string, second: string): Promise<void> {
  await press(boardItems(page, first).first(), testInfo);
  await press(boardItems(page, second).first(), testInfo);
}

test.describe('обложка', () => {
  test('титул — закрытая книга, кнопка раскрывает её на лабораторию', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByTestId('book')).toHaveAttribute('data-page', 'title');
    await press(page.getByTestId('open-book'), testInfo);
    await expect(page.getByTestId('book')).toHaveAttribute('data-page', 'lab');
    await expect(page.getByTestId('board')).toBeVisible();
  });
});

test.describe('иллюстрации элементов', () => {
  test('рисунки новой серии загружаются, прежние эскизы остаются', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    for (const id of ['water', 'fire']) {
      const image = page.getByTestId(`catalog-${id}`).locator('img');
      await expect(image).toHaveCount(1);
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth)).toBe(256);
    }
    await expect(page.getByTestId('catalog-earth').locator('.medal')).toHaveAttribute('data-art', 'sketch');
    await expect(page.getByTestId('catalog-earth').locator('svg')).toHaveCount(1);
  });
});

test.describe('реакция соединения', () => {
  test('новое открытие: золотая реакция, результат проявляется и реакция убирается', async ({ page }, testInfo) => {
    await openWith(page, testInfo, {
      discovered: STARTING,
      board: [
        { id: 'water', x: 0.35, y: 0.5 },
        { id: 'fire', x: 0.65, y: 0.5 },
      ],
    });
    await combineOnBoard(page, testInfo, 'water', 'fire');
    await expect(page.locator('[data-testid="reaction"][data-kind="discovery"]')).toHaveCount(1);
    await expect(boardItems(page, 'steam')).toHaveClass(/is-discovery/);
    // Реакция не перехватывает нажатия и удаляется сама
    await expect(page.getByTestId('reaction')).toHaveCount(0, { timeout: 3000 });
    await expect(boardItems(page, 'steam')).not.toHaveClass(/is-discovery/, { timeout: 3000 });
  });

  test('тайное открытие: реакция сильнее, результат отмечен как тайный', async ({ page }, testInfo) => {
    await openWith(page, testInfo, {
      discovered: [...STARTING, 'life', 'mercury'],
      board: [
        { id: 'life', x: 0.35, y: 0.5 },
        { id: 'mercury', x: 0.65, y: 0.5 },
      ],
    });
    await combineOnBoard(page, testInfo, 'life', 'mercury');
    await expect(page.locator('[data-testid="reaction"][data-kind="secret"]')).toHaveCount(1);
    await expect(boardItems(page, 'homunculus')).toHaveClass(/is-secret/);
    await expect(page.getByTestId('toast')).toContainText('Гомункул');
  });

  test('повтор известного рецепта: дымок без золота, анимации открытия нет', async ({ page }, testInfo) => {
    await openWith(page, testInfo, {
      discovered: [...STARTING, 'steam'],
      recipes: ['fire|water'],
      board: [
        { id: 'water', x: 0.35, y: 0.5 },
        { id: 'fire', x: 0.65, y: 0.5 },
      ],
    });
    await combineOnBoard(page, testInfo, 'water', 'fire');
    await expect(page.locator('[data-testid="reaction"][data-kind="known"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="reaction"][data-kind="discovery"]')).toHaveCount(0);
    await expect(page.locator('.is-discovery')).toHaveCount(0);
    await expect(boardItems(page, 'steam')).toHaveCount(0);
  });

  test('при уменьшении движения реакции нет, результат сразу на месте', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWith(page, testInfo, {
      discovered: STARTING,
      board: [
        { id: 'water', x: 0.35, y: 0.5 },
        { id: 'fire', x: 0.65, y: 0.5 },
      ],
    });
    await combineOnBoard(page, testInfo, 'water', 'fire');
    await expect(boardItems(page, 'steam')).toBeVisible();
    await expect(page.getByTestId('reaction')).toHaveCount(0);
    // Золотое сияние без анимации не показывается — иначе оно не исчезло бы
    const aura = await boardItems(page, 'steam')
      .locator('.medal')
      .evaluate((node) => getComputedStyle(node, '::before').display);
    expect(aura).toBe('none');
  });
});

test.describe('звук', () => {
  test('панель звука: музыка и эффекты выключаются отдельно, настройки переживают перезагрузку', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    const toggle = page.getByTestId('sound-toggle');
    const panel = page.getByTestId('sound-panel');
    await expect(panel).toBeHidden();
    await press(toggle, testInfo);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('sound-all')).toBeChecked();
    await expect(page.getByTestId('music-enabled')).toBeChecked();
    await expect(page.getByTestId('effects-enabled')).toBeChecked();

    await page.getByTestId('music-enabled').uncheck();
    await page.getByTestId('effects-volume').fill('30');
    await page.getByTestId('music-volume').fill('40');
    const stored = await page.evaluate(() => localStorage.getItem('last-alchemist:sound'));
    // Ползунок музыки снова включает музыку
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ muted: false, musicMuted: false, musicVolume: 0.4, volume: 0.3 });
    await page.getByTestId('music-enabled').uncheck();

    await openLab(page, testInfo);
    await press(page.getByTestId('sound-toggle'), testInfo);
    await expect(page.getByTestId('music-enabled')).not.toBeChecked();
    await expect(page.getByTestId('effects-enabled')).toBeChecked();
    await expect(page.getByTestId('effects-volume')).toHaveValue('30');
    await expect(page.getByTestId('music-volume')).toHaveValue('40');
  });

  test('«весь звук» выключает всё, панель закрывается клавишей Esc и касанием вне', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    await press(page.getByTestId('sound-toggle'), testInfo);
    await page.getByTestId('sound-all').uncheck();
    await expect(page.getByTestId('sound-toggle')).toHaveAttribute('data-audible', 'false');
    await expect(page.getByTestId('music-volume')).toBeDisabled();
    await expect(page.getByTestId('effects-enabled')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('sound-panel')).toBeHidden();
    await press(page.getByTestId('sound-toggle'), testInfo);
    await expect(page.getByTestId('sound-panel')).toBeVisible();
    // Касание стола вне панели (на низком экране панель закрывает его середину)
    const board = page.getByTestId('board');
    const box = await board.boundingBox();
    const corner = { x: 12, y: (box?.height ?? 40) - 12 };
    if (testInfo.project.use.hasTouch) await board.tap({ position: corner });
    else await board.click({ position: corner });
    await expect(page.getByTestId('sound-panel')).toBeHidden();
    // Игра продолжается и без звука
    await press(page.getByTestId('catalog-water'), testInfo);
    await expect(boardItems(page, 'water')).toHaveCount(1);
  });

  test('эффекты скачиваются после готовности игры, музыка — только после первого жеста', async ({ page }, testInfo) => {
    const loaded = new Map<string, number>();
    page.on('response', (response) => {
      if (response.url().endsWith('.mp3')) loaded.set(response.url(), response.status());
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect.poll(() => loaded.size).toBe(6);
    expect([...loaded.keys()].some((url) => /music/.test(url))).toBe(false);

    await press(page.getByTestId('open-book'), testInfo);
    await expect.poll(() => [...loaded.keys()].some((url) => /music/.test(url))).toBe(true);
    expect([...loaded.values()].every((status) => status === 200)).toBe(true);
  });

  test('музыка играет одним бесшовным источником и не перезапускается от действий игрока', async ({ page }, testInfo) => {
    // Записываем запуски источников Web Audio: эффекты — без цикла, музыка — с циклом
    await page.addInitScript(() => {
      const starts: { loop: boolean; loopStart: number; loopEnd: number; offset: number | undefined }[] = [];
      (window as unknown as { __starts: typeof starts }).__starts = starts;
      const prototype = AudioBufferSourceNode.prototype;
      const original = Object.getOwnPropertyDescriptor(prototype, 'start')!.value as (this: AudioBufferSourceNode, ...args: number[]) => void;
      prototype.start = function (this: AudioBufferSourceNode, ...args: number[]) {
        starts.push({ loop: this.loop, loopStart: this.loopStart, loopEnd: this.loopEnd, offset: args[1] });
        original.apply(this, args);
      };
    });
    await openLab(page, testInfo);
    const starts = () =>
      page.evaluate(() => (window as unknown as { __starts: { loop: boolean; loopStart: number; loopEnd: number }[] }).__starts);
    await expect.poll(async () => (await starts()).filter((s) => s.loop).length, { timeout: 10_000 }).toBe(1);
    const music = (await starts()).find((s) => s.loop)!;
    expect(music.loopStart).toBeCloseTo(0.5);
    expect(music.loopEnd).toBeCloseTo(128.5);

    // Размещение и соединения: звучат эффекты, музыка продолжается тем же источником
    await press(page.getByTestId('catalog-water'), testInfo);
    await press(boardItems(page, 'water'), testInfo);
    await press(page.getByTestId('catalog-fire'), testInfo);
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await expect.poll(async () => (await starts()).filter((s) => !s.loop).length).toBeGreaterThan(1);
    expect((await starts()).filter((s) => s.loop)).toHaveLength(1);
  });

  test('скрытая вкладка приостанавливает звук, возвращение продолжает ту же музыку', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const state = { hidden: false, contexts: [] as AudioContext[], loops: 0 };
      (window as unknown as { __audio: typeof state }).__audio = state;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => state.hidden });
      const Original = window.AudioContext;
      window.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          state.contexts.push(this);
        }
      };
      const prototype = AudioBufferSourceNode.prototype;
      const start = Object.getOwnPropertyDescriptor(prototype, 'start')!.value as (this: AudioBufferSourceNode, ...args: number[]) => void;
      prototype.start = function (this: AudioBufferSourceNode, ...args: number[]) {
        if (this.loop) state.loops += 1;
        start.apply(this, args);
      };
    });
    await openLab(page, testInfo);
    const audio = () =>
      page.evaluate(() => {
        const state = (window as unknown as { __audio: { contexts: AudioContext[]; loops: number } }).__audio;
        return { states: state.contexts.map((c) => c.state), loops: state.loops };
      });
    await expect.poll(async () => (await audio()).loops, { timeout: 10_000 }).toBe(1);
    const setHidden = (hidden: boolean) =>
      page.evaluate((value) => {
        (window as unknown as { __audio: { hidden: boolean } }).__audio.hidden = value;
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);

    await setHidden(true);
    await expect.poll(async () => (await audio()).states).toEqual(['suspended']);
    await setHidden(false);
    await expect.poll(async () => (await audio()).states).toEqual(['running']);
    // Музыка не перезапускалась: по-прежнему один источник с циклом
    expect((await audio()).loops).toBe(1);
  });

  test('при выключенной музыке её файл не загружается', async ({ page }, testInfo) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('last-alchemist:sound', JSON.stringify({ musicMuted: true })));
    await openLab(page, testInfo);
    await press(page.getByTestId('catalog-water'), testInfo);
    await page.waitForTimeout(500);
    expect(requested.some((url) => /music/.test(url))).toBe(false);
  });
});
