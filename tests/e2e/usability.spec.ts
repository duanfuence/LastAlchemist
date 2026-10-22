import type { Page, TestInfo } from '@playwright/test';
import { expect, press, test } from './fixtures';
import { boardItems, boardPoint, expectNoHorizontalOverflow, medalCenter, mouseDrag, openLab, touchDrag } from './game-helpers';

/** Профили с одностраничной раскладкой (телефон и планшет в портретной ориентации). */
const isPortrait = (testInfo: TestInfo): boolean => {
  const viewport = testInfo.project.use.viewport;
  return Boolean(viewport && viewport.height > viewport.width);
};
const isTouch = (testInfo: TestInfo): boolean => Boolean(testInfo.project.use.hasTouch);

const STARTING = ['water', 'fire', 'earth', 'air'];

async function placeByTaps(page: Page, testInfo: TestInfo, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) await press(page.getByTestId(`catalog-${STARTING[i % 4]}`), testInfo);
  await expect(boardItems(page)).toHaveCount(count);
}

async function medalCenters(page: Page): Promise<{ x: number; y: number }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.board-item:not(.is-merging) .medal')].map((medal) => {
      const r = medal.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }),
  );
}

/** Пары медальонов, центры которых ближе 90% диаметра, — элементы закрывают друг друга. */
async function countOverlaps(page: Page): Promise<number> {
  return page.evaluate(() => {
    const medals = [...document.querySelectorAll('.board-item:not(.is-merging) .medal')].map((m) =>
      m.getBoundingClientRect(),
    );
    let overlaps = 0;
    for (let a = 0; a < medals.length; a += 1) {
      for (let b = a + 1; b < medals.length; b += 1) {
        const A = medals[a]!;
        const B = medals[b]!;
        if (Math.hypot(A.x - B.x, A.y - B.y) < A.width * 0.9) overlaps += 1;
      }
    }
    return overlaps;
  });
}

const sheet = (page: Page) => page.getByTestId('catalog');

test.describe('полный список на телефоне — вкладной лист', () => {
  test('открытый список не сжимает стол и не сдвигает элементы', async ({ page }, testInfo) => {
    test.skip(!isPortrait(testInfo), 'в развороте список — левая страница, лист не нужен');
    await openLab(page, testInfo);
    await placeByTaps(page, testInfo, 6);
    const boardBefore = await page.getByTestId('board').boundingBox();
    const centersBefore = await medalCenters(page);
    expect(await countOverlaps(page)).toBe(0);

    await press(page.getByTestId('catalog-toggle'), testInfo);
    await expect(sheet(page)).toHaveAttribute('data-expanded', '');
    await expect(page.getByTestId('catalog-toggle')).toHaveText('Закрыть');
    await expect(page.getByTestId('board')).toHaveJSProperty('offsetHeight', Math.round(boardBefore!.height));
    expect(await page.getByTestId('board').boundingBox()).toEqual(boardBefore);
    expect(await medalCenters(page)).toEqual(centersBefore);
    expect(await countOverlaps(page)).toBe(0);
    await expectNoHorizontalOverflow(page);

    // Выбор в листе кладёт элемент на стол и закрывает лист; прежние элементы на местах
    await press(page.getByTestId('catalog-earth'), testInfo);
    await expect(sheet(page)).not.toHaveAttribute('data-expanded');
    await expect(boardItems(page)).toHaveCount(7);
    expect((await medalCenters(page)).slice(0, 6)).toEqual(centersBefore);
    expect(await page.getByTestId('board').boundingBox()).toEqual(boardBefore);
  });

  test('лист закрывается кнопкой, клавишей Esc и касанием видимой части стола', async ({ page }, testInfo) => {
    test.skip(!isPortrait(testInfo), 'в развороте список — левая страница, лист не нужен');
    await openLab(page, testInfo);
    const toggle = page.getByTestId('catalog-toggle');

    await press(toggle, testInfo);
    await expect(sheet(page)).toHaveAttribute('data-expanded', '');
    await press(toggle, testInfo);
    await expect(sheet(page)).not.toHaveAttribute('data-expanded');

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(sheet(page)).toHaveAttribute('data-expanded', '');
    await page.keyboard.press('Escape');
    await expect(sheet(page)).not.toHaveAttribute('data-expanded');
    await expect(toggle).toBeFocused();

    await press(toggle, testInfo);
    const top = await boardPoint(page, 0.5, 0.06);
    if (isTouch(testInfo)) await page.touchscreen.tap(top.x, top.y);
    else await page.mouse.click(top.x, top.y);
    await expect(sheet(page)).not.toHaveAttribute('data-expanded');
  });

  test('выбранный на столе элемент соединяется с элементом из листа', async ({ page }, testInfo) => {
    test.skip(!isPortrait(testInfo), 'в развороте список — левая страница, лист не нужен');
    await openLab(page, testInfo);
    await press(page.getByTestId('catalog-water'), testInfo);
    await press(boardItems(page, 'water'), testInfo);
    await press(page.getByTestId('catalog-toggle'), testInfo);
    await expect(page.getByTestId('sheet-context')).toHaveText('Соединить с элементом «Вода» на столе:');
    await press(page.getByTestId('catalog-fire'), testInfo);
    await expect(sheet(page)).not.toHaveAttribute('data-expanded');
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');
  });

  test('элемент из открытого листа переносится пальцем на элемент стола', async ({ page }, testInfo) => {
    test.skip(!isPortrait(testInfo) || !isTouch(testInfo), 'сенсорный экран в портретной ориентации');
    await openLab(page, testInfo);
    await press(page.getByTestId('catalog-water'), testInfo);
    const water = await medalCenter(boardItems(page, 'water'));
    await press(page.getByTestId('catalog-toggle'), testInfo);
    await expect(sheet(page)).toHaveAttribute('data-expanded', '');
    // Быстрое движение пальцем листает список и ничего не переносит
    await touchDrag(page, page.getByTestId('catalog-fire'), water);
    await expect(sheet(page)).toHaveAttribute('data-expanded', '');
    await expect(boardItems(page, 'steam')).toHaveCount(0);
    // Удержание берёт элемент: лист уходит, открывая весь стол, и элемент ложится на цель
    await touchDrag(page, page.getByTestId('catalog-fire'), water, 450);
    await expect(sheet(page)).not.toHaveAttribute('data-expanded');
    await expect(boardItems(page, 'steam')).toHaveCount(1);
  });

  test('при повороте в альбомную ориентацию лист закрывается, список становится страницей', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-portrait', 'поворот проверяется на телефоне');
    await openLab(page, testInfo);
    await placeByTaps(page, testInfo, 4);
    await press(page.getByTestId('catalog-toggle'), testInfo);
    await expect(sheet(page)).toHaveAttribute('data-expanded', '');

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(sheet(page)).not.toHaveAttribute('data-expanded');
    await expect(page.getByTestId('catalog-toggle')).toBeHidden();
    await expect(page.getByTestId('catalog-water')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(await countOverlaps(page)).toBe(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('catalog-toggle')).toBeVisible();
    expect(await countOverlaps(page)).toBe(0);
  });

  test('в развороте список — постоянная страница без листа', async ({ page }, testInfo) => {
    test.skip(isPortrait(testInfo), 'проверяется в альбомной ориентации');
    await openLab(page, testInfo);
    await expect(page.getByTestId('catalog-toggle')).toBeHidden();
    for (const id of STARTING) await expect(page.getByTestId(`catalog-${id}`)).toBeVisible();
  });
});

test.describe('уведомление об открытии', () => {
  test('появляется над книгой, не закрывает стол и не мешает нажатиям', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    // Вода у самого верхнего края стола — там раньше появлялось уведомление
    const top = await boardPoint(page, 0.5, 0.1);
    if (isTouch(testInfo)) await touchDrag(page, page.getByTestId('catalog-water'), top);
    else await mouseDrag(page, page.getByTestId('catalog-water'), top);
    await expect(boardItems(page, 'water')).toHaveCount(1);
    await press(boardItems(page, 'water'), testInfo);
    await press(page.getByTestId('catalog-fire'), testInfo);
    await expect(boardItems(page, 'steam')).toHaveCount(1);

    const toast = page.getByTestId('toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Новое открытие');
    await toast.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
    const [toastBox, barBox, boardBox] = await Promise.all([
      toast.boundingBox(),
      page.locator('.desk-bar').boundingBox(),
      page.getByTestId('board').boundingBox(),
    ]);
    expect(toastBox && barBox && boardBox).toBeTruthy();
    if (!toastBox || !barBox || !boardBox) return;
    // Целиком в панели над книгой и ниже не заходит
    expect(toastBox.y).toBeGreaterThanOrEqual(barBox.y - 1);
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(barBox.y + barBox.height + 1);
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(boardBox.y);
    // Кнопки панели остаются открытыми
    for (const id of ['lab-back', 'clear-board']) {
      const button = await page.getByTestId(id).boundingBox();
      const overlapX = Math.min(button!.x + button!.width, toastBox.x + toastBox.width) - Math.max(button!.x, toastBox.x);
      expect(overlapX, id).toBeLessThanOrEqual(0);
    }

    // Пока уведомление видно, полученный элемент сразу можно выбрать
    await press(boardItems(page, 'steam'), testInfo);
    await expect(boardItems(page, 'steam')).toHaveClass(/is-selected/);
    await expect(toast).toBeVisible();
  });
});

test.describe('первые шаги', () => {
  test('записка первого опыта ведёт к открытию и больше не появляется', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    const coach = page.getByTestId('coach');
    await expect(coach).toBeVisible();
    await expect(coach).toContainText('Первый опыт: Вода + Огонь');
    await expect(coach).toHaveAttribute('data-step', 'place');
    await expect(page.getByTestId('catalog-water')).toHaveClass(/is-suggested/);
    await expect(page.getByTestId('catalog-fire')).toHaveClass(/is-suggested/);
    // Нижняя подпись не дублирует записку
    await expect(page.getByTestId('board-caption')).toHaveText('');

    await press(page.getByTestId('catalog-water'), testInfo);
    await expect(coach).toHaveAttribute('data-step', 'combine');
    await press(boardItems(page, 'water'), testInfo);
    await expect(coach).toHaveAttribute('data-step', 'second');
    await expect(coach).toContainText('коснитесь «Огонь»');

    // Записка не перехватывает нажатия: под ней можно взять элемент
    await press(page.getByTestId('catalog-fire'), testInfo);
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await expect(coach).toBeHidden();
    await expect(page.getByTestId('catalog-water')).not.toHaveClass(/is-suggested/);

    await page.reload();
    await press(page.getByTestId('open-book'), testInfo);
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(page.getByTestId('coach')).toBeHidden();
  });

  test('элементы, положенные касанием, не закрывают текст записки', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    const coachText = page.locator('.board__coach-text');
    for (const step of ['catalog-water', 'catalog-earth', 'catalog-air']) {
      await press(page.getByTestId(step), testInfo);
      const covered = await page.evaluate(() => {
        const text = document.querySelector('.board__coach-text')!.getBoundingClientRect();
        const title = document.querySelector('.board__coach-title')!.getBoundingClientRect();
        return [...document.querySelectorAll('.board-item')].filter((item) => {
          const r = item.getBoundingClientRect();
          return [text, title].some(
            (t) => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top,
          );
        }).length;
      });
      expect(covered, `после ${step}`).toBe(0);
    }
    await expect(coachText).toBeVisible();
  });

  test('записка не перекрывает элементы, положенные на стол', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    await placeByTaps(page, testInfo, 4);
    const coachBox = await page.getByTestId('coach').boundingBox();
    const hits = await page.evaluate(() =>
      [...document.querySelectorAll('.board-item .medal')].filter((medal) => {
        const r = medal.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !medal.closest('.board-item')?.contains(top);
      }).length,
    );
    expect(coachBox).not.toBeNull();
    expect(hits, 'медальоны, закрытые другими слоями').toBe(0);
  });
});

test.describe('размещение и лента', () => {
  test('на тесном столе элементы не ложатся стопкой', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    await placeByTaps(page, testInfo, 8);
    const centers = await medalCenters(page);
    const size = await page.locator('.board-item .medal').first().evaluate((m) => m.getBoundingClientRect().width);
    for (let a = 0; a < centers.length; a += 1) {
      for (let b = a + 1; b < centers.length; b += 1) {
        const distance = Math.hypot(centers[a]!.x - centers[b]!.x, centers[a]!.y - centers[b]!.y);
        expect(distance, `элементы ${a} и ${b}`).toBeGreaterThan(size * 0.5);
      }
    }
  });

  test('в ленте телефона стихии идут по порядку, свежее открытие — первым', async ({ page }, testInfo) => {
    test.skip(!isPortrait(testInfo), 'лента бывает только в одностраничной раскладке');
    await openLab(page, testInfo);
    const order = async () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.catalog-item')]
          .map((n) => ({ id: n.dataset['element'] ?? '', x: n.getBoundingClientRect().x }))
          .sort((a, b) => a.x - b.x)
          .map((n) => n.id),
      );
    expect(await order()).toEqual(['water', 'fire', 'earth', 'air']);
    await press(page.getByTestId('catalog-water'), testInfo);
    await press(boardItems(page, 'water'), testInfo);
    await press(page.getByTestId('catalog-fire'), testInfo);
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    expect(await order()).toEqual(['steam', 'water', 'fire', 'earth', 'air']);
  });
});
