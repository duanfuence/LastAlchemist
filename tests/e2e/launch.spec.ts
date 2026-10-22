import { expect, test, type Page } from '@playwright/test';
import { collectConsoleErrors, press, stubYandexSdk } from './fixtures';

async function waitForReady(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}

async function expectNoPageScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(overflow.x).toBeLessThanOrEqual(0);
  expect(overflow.y).toBeLessThanOrEqual(0);
}

async function expectInsideViewport(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  expect(box, selector).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x, selector).toBeGreaterThanOrEqual(0);
  expect(box.y, selector).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, selector).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, selector).toBeLessThanOrEqual(viewport.height);
}

test.describe('экран запуска', () => {
  test('титульная страница помещается в экран без прокрутки', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');
    await waitForReady(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Книга последнего алхимика');
    await expect(page.getByTestId('open-book')).toBeVisible();
    await expect(page.getByRole('img', { name: /Алхимическая эмблема/ })).toBeVisible();
    await expect(page).toHaveTitle('Книга последнего алхимика');

    await expectNoPageScroll(page);
    for (const selector of ['h1', '[data-testid="open-book"]', '.title-page__emblem', '.hand-note']) {
      await expectInsideViewport(page, selector);
    }
    expect(errors).toEqual([]);
  });

  test('все шрифты проекта загружены к моменту готовности', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const loaded = await page.evaluate(() =>
      [
        '500 16px "Cormorant Garamond"',
        'italic 500 16px "Cormorant Garamond"',
        '700 16px "Cormorant Garamond"',
        '400 16px "Marck Script"',
      ].map((font) => document.fonts.check(font, 'Книга Aa')),
    );
    expect(loaded).toEqual([true, true, true, true]);
  });

  test('книга открывается на странице четырёх начал и закрывается', async ({ page }, testInfo) => {
    const errors = collectConsoleErrors(page);
    await page.goto('/');
    await waitForReady(page);

    await press(page.getByTestId('open-book'), testInfo);
    const cards = page.locator('[data-element]');
    await expect(cards).toHaveCount(4);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Четыре начала');
    for (const name of ['Вода', 'Огонь', 'Земля', 'Воздух']) {
      await expect(page.getByRole('heading', { level: 3, name })).toBeVisible();
    }
    await expect(cards.locator('svg').first()).toBeVisible();
    await expectNoPageScroll(page);

    // Страница может прокручиваться внутри книги, но кнопка возврата доступна
    const close = page.getByTestId('close-book');
    await close.scrollIntoViewIfNeeded();
    await press(close, testInfo);
    await expect(page.getByTestId('open-book')).toBeVisible();
    await expectNoPageScroll(page);
    expect(errors).toEqual([]);
  });

  test('контекстное меню браузера отключено', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const prevented = await page.evaluate(() => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      return !document.querySelector('h1')?.dispatchEvent(event);
    });
    expect(prevented).toBe(true);
  });
});

test.describe('интеграция с площадкой', () => {
  test('без SDK игра работает на локальной платформе', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'local');
  });

  test('с SDK вызывает LoadingAPI.ready() один раз после отрисовки', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await stubYandexSdk(page);
    await page.goto('/');
    await waitForReady(page);

    await expect(page.locator('html')).toHaveAttribute('data-platform', 'yandex');
    const sdk = await page.evaluate(() => (window as unknown as { __sdk: Record<string, unknown> }).__sdk);
    expect(sdk['initCalls']).toBe(1);
    expect(sdk['readyCalls']).toBe(1);
    expect(sdk['titleVisibleAtReady']).toBe(true);
    expect(errors).toEqual([]);
  });

  test('пауза площадки останавливает анимации', async ({ page }) => {
    await stubYandexSdk(page);
    await page.goto('/');
    await waitForReady(page);

    const emit = (event: string) =>
      page.evaluate((name) => {
        const sdk = (window as unknown as { __sdk: { handlers: Record<string, () => void> } }).__sdk;
        sdk.handlers[name]?.();
      }, event);
    const candleState = () =>
      page.evaluate(() => getComputedStyle(document.querySelector('.desk')!, '::before').animationPlayState);

    await emit('game_api_pause');
    await expect(page.locator('html')).toHaveAttribute('data-paused', '');
    expect(await candleState()).toBe('paused');

    await emit('game_api_resume');
    await expect(page.locator('html')).not.toHaveAttribute('data-paused');
    expect(await candleState()).toBe('running');
  });
});
