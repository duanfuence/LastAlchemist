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
  test('кнопка выключает звук, настройка переживает перезагрузку', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    const toggle = page.getByTestId('sound-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await press(toggle, testInfo);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const stored = await page.evaluate(() => localStorage.getItem('last-alchemist:sound'));
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ muted: true });

    await openLab(page, testInfo);
    await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    await press(page.getByTestId('sound-toggle'), testInfo);
    await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  test('ползунок громкости на широком экране меняет громкость', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    const volume = page.getByTestId('sound-volume');
    test.skip(!(await volume.isVisible()), 'ползунок есть только на широких экранах');
    await volume.fill('30');
    const stored = await page.evaluate(() => localStorage.getItem('last-alchemist:sound'));
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ volume: 0.3, muted: false });
  });

  test('звуковые файлы загружаются после готовности игры', async ({ page }, testInfo) => {
    const loaded = new Map<string, number>();
    page.on('response', (response) => {
      if (response.url().endsWith('.mp3')) loaded.set(response.url(), response.status());
    });
    await openLab(page, testInfo);
    await expect.poll(() => loaded.size).toBe(6);
    expect([...loaded.values()].every((status) => status === 200)).toBe(true);
  });
});
