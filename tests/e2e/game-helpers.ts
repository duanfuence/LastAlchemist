import type { Locator, Page, TestInfo } from '@playwright/test';
import { expect, press } from './fixtures';

export const SAVE_KEY = 'last-alchemist:save';

export async function openLab(page: Page, testInfo: TestInfo): Promise<void> {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await press(page.getByTestId('open-book'), testInfo);
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.locator('.page__content')).not.toHaveClass(/is-entering|is-leaving/);
}

/** Элементы стола, не считая исчезающих после соединения. */
export function boardItems(page: Page, elementId?: string): Locator {
  return page.locator(`.board-item:not(.is-merging)${elementId ? `[data-element="${elementId}"]` : ''}`);
}

export async function medalCenter(locator: Locator): Promise<{ x: number; y: number }> {
  const target = (await locator.locator('.medal').count()) > 0 ? locator.locator('.medal').first() : locator;
  const box = await target.boundingBox();
  if (!box) throw new Error('элемент не виден');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Точка на столе в долях его размера. */
export async function boardPoint(page: Page, fx: number, fy: number): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('стол не виден');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

/** Перетаскивание мышью с промежуточными шагами, как у человека. */
export async function mouseDrag(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
  const start = await medalCenter(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(start.x + ((to.x - start.x) * i) / steps, start.y + ((to.y - start.y) * i) / steps);
  }
  await page.mouse.up();
}

/** Перетаскивание пальцем: настоящие сенсорные события Chromium через CDP. */
export async function touchDrag(
  page: Page,
  from: Locator,
  to: { x: number; y: number },
  holdMs = 0,
): Promise<void> {
  const start = await medalCenter(from);
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }],
    });
  await touch('touchStart', start.x, start.y);
  // Удержание пальца перед переносом (элементы вкладного листа берутся удержанием)
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  const steps = 14;
  for (let i = 1; i <= steps; i += 1) {
    await touch('touchMove', start.x + ((to.x - start.x) * i) / steps, start.y + ((to.y - start.y) * i) / steps);
  }
  await touch('touchEnd', to.x, to.y);
  await cdp.detach();
}

export async function waitForSaved(page: Page, fragment: string): Promise<void> {
  await page.waitForFunction(
    ([key, text]) => (localStorage.getItem(key) ?? '').includes(text),
    [SAVE_KEY, fragment] as const,
  );
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    page: (() => {
      const node = document.querySelector<HTMLElement>('.page__content');
      return node ? node.scrollWidth - node.clientWidth : 0;
    })(),
    board: (() => {
      const node = document.querySelector<HTMLElement>('[data-testid="board"]');
      return node ? node.scrollWidth - node.clientWidth : 0;
    })(),
  }));
  expect(overflow.document, 'документ').toBeLessThanOrEqual(0);
  expect(overflow.page, 'страница книги').toBeLessThanOrEqual(0);
  expect(overflow.board, 'стол').toBeLessThanOrEqual(0);
}
