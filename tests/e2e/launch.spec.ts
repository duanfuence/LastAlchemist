import type { Page } from '@playwright/test';
import { expect, press, stubYandexSdk, test } from './fixtures';

async function waitForReady(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}

async function waitTurnFinished(page: Page): Promise<void> {
  await expect(page.locator('.page__content')).not.toHaveClass(/is-entering|is-leaving/);
}

async function openLabPage(page: Page, testInfo: Parameters<typeof press>[1]): Promise<void> {
  await press(page.getByTestId('open-book'), testInfo);
  await expect(page.getByTestId('board')).toBeVisible();
  await waitTurnFinished(page);
}

/** Ни документ, ни область текста не прокручиваются по горизонтали. */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('.page__content');
    return {
      documentX: document.documentElement.scrollWidth - window.innerWidth,
      documentY: document.documentElement.scrollHeight - window.innerHeight,
      contentX: content ? content.scrollWidth - content.clientWidth : 0,
    };
  });
  expect(overflow.documentX, 'горизонтальная прокрутка документа').toBeLessThanOrEqual(0);
  expect(overflow.documentY, 'вертикальная прокрутка документа').toBeLessThanOrEqual(0);
  expect(overflow.contentX, 'горизонтальная прокрутка страницы книги').toBeLessThanOrEqual(0);
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

/**
 * Видимая часть текста и кнопок не заходит в «чернильную» зону угловых орнаментов.
 * Внутри квадрата уголка рисунок занимает всё, кроме внутренней четверти (от 0,55 стороны),
 * поэтому пересечение допускается только там.
 */
async function findDecorOverlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('.page__content');
    if (!content) return ['нет .page__content'];
    const viewport = content.getBoundingClientRect();
    const clip = (r: DOMRect, c: DOMRect) => ({
      left: Math.max(r.left, c.left),
      top: Math.max(r.top, c.top),
      right: Math.min(r.right, c.right),
      bottom: Math.min(r.bottom, c.bottom),
    });
    const texts = [
      ...Array.from(content.querySelectorAll<HTMLElement>('h1, h2, h3, p, button')).map((el) => ({
        el,
        rect: clip(el.getBoundingClientRect(), viewport),
      })),
      ...Array.from(document.querySelectorAll<HTMLElement>('[data-testid="scroll-hint"]:not([hidden])')).map(
        (el) => ({ el, rect: clip(el.getBoundingClientRect(), el.getBoundingClientRect()) }),
      ),
    ].filter(({ rect }) => rect.right > rect.left && rect.bottom > rect.top);

    const problems: string[] = [];
    for (const corner of Array.from(document.querySelectorAll<HTMLElement>('.page__corner'))) {
      const c = corner.getBoundingClientRect();
      const size = c.width;
      const position = corner.className.match(/--(tl|tr|bl|br)/)?.[1] ?? 'tl';
      for (const { el, rect } of texts) {
        const i = clip(new DOMRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top), c);
        if (i.right <= i.left || i.bottom <= i.top) continue;
        const nearX = position.endsWith('l') ? i.left - c.left : c.right - i.right;
        const nearY = position.startsWith('t') ? i.top - c.top : c.bottom - i.bottom;
        if (nearX < size * 0.55 || nearY < size * 0.55) {
          problems.push(`${el.tagName.toLowerCase()} «${el.textContent?.trim().slice(0, 30)}» заходит на уголок ${position}`);
        }
      }
    }
    return problems;
  });
}

test.describe('экран запуска', () => {
  test('титульная страница помещается в экран без прокрутки', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Книга последнего алхимика');
    await expect(page.getByTestId('open-book')).toBeVisible();
    await expect(page.getByRole('img', { name: /Алхимическая эмблема/ })).toBeVisible();
    await expect(page).toHaveTitle('Книга последнего алхимика');

    await expectNoHorizontalScroll(page);
    for (const selector of ['.overline', 'h1', '[data-testid="open-book"]', '.title-page__emblem', '.hand-note']) {
      await expectInsideViewport(page, selector);
    }
    await expect(page.getByTestId('scroll-hint')).toBeHidden();
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

  test('у игры есть собственная иконка', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toBeTruthy();
    const response = await page.request.get(new URL(href ?? '', page.url()).toString());
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<svg');
  });

  test('книга открывается на лаборатории и закрывается', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForReady(page);
    await openLabPage(page, testInfo);

    await expect(page.getByTestId('catalog')).toBeVisible();
    await expect(page.locator('.catalog-item svg').first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    await press(page.getByTestId('lab-back'), testInfo);
    await expect(page.getByTestId('open-book')).toBeVisible();
    await expectNoHorizontalScroll(page);
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

test.describe('раскладка', () => {
  test('декор не перекрывает текст ни на титуле, ни в лаборатории', async ({ page }, testInfo) => {
    await page.goto('/');
    await waitForReady(page);
    expect(await findDecorOverlaps(page), 'титульная страница').toEqual([]);

    await openLabPage(page, testInfo);
    for (const id of ['water', 'fire', 'earth', 'air']) await press(page.getByTestId(`catalog-${id}`), testInfo);
    expect(await findDecorOverlaps(page), 'лаборатория').toEqual([]);
  });

  test('если титул не помещается, прокрутка заметна и доводит до кнопки', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-small', 'проверяется на искусственно низком экране');
    // Экран ниже любого реального телефона: титул заведомо не помещается
    await page.setViewportSize({ width: 320, height: 440 });
    await page.goto('/');
    await waitForReady(page);

    const content = page.locator('.page__content');
    const hint = page.getByTestId('scroll-hint');
    expect(await content.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeGreaterThan(2);

    await expect(hint).toBeVisible();
    await expect(page.locator('.page')).toHaveAttribute('data-more-below', '');
    await expectInsideViewport(page, '[data-testid="scroll-hint"]');

    await press(hint, testInfo);
    await expect.poll(() => content.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('.page')).toHaveAttribute('data-more-above', '');

    await content.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(hint).toBeHidden();
    const open = page.getByTestId('open-book');
    const [openBox, viewBox] = await Promise.all([open.boundingBox(), content.boundingBox()]);
    expect(openBox && viewBox).toBeTruthy();
    if (openBox && viewBox) {
      expect(openBox.y).toBeGreaterThanOrEqual(viewBox.y);
      expect(openBox.y + openBox.height).toBeLessThanOrEqual(viewBox.y + viewBox.height);
    }
    await press(open, testInfo);
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(hint).toBeHidden();
  });

  test('при повороте экрана раскладка перестраивается', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-portrait', 'поворот проверяется на телефоне');
    await page.goto('/');
    await waitForReady(page);

    const layout = async () => {
      const [emblem, title] = await Promise.all([
        page.locator('.title-page__emblem').boundingBox(),
        page.locator('h1').boundingBox(),
      ]);
      if (!emblem || !title) throw new Error('нет эмблемы или заголовка');
      if (emblem.y + emblem.height <= title.y) return 'эмблема над заголовком';
      if (emblem.x + emblem.width <= title.x) return 'эмблема слева от заголовка';
      return 'другое';
    };

    expect(await layout()).toBe('эмблема над заголовком');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(layout).toBe('эмблема слева от заголовка');
    await expectNoHorizontalScroll(page);
    await expectInsideViewport(page, '[data-testid="open-book"]');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(layout).toBe('эмблема над заголовком');
    await expectNoHorizontalScroll(page);
  });
});

test.describe('интеграция с площадкой', () => {
  test('без SDK игра работает на локальной платформе', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'local');
  });

  test('с SDK вызывает LoadingAPI.ready() один раз после отрисовки', async ({ page }) => {
    await stubYandexSdk(page);
    await page.goto('/');
    await waitForReady(page);

    await expect(page.locator('html')).toHaveAttribute('data-platform', 'yandex');
    const sdk = await page.evaluate(() => (window as unknown as { __sdk: Record<string, unknown> }).__sdk);
    expect(sdk['initCalls']).toBe(1);
    expect(sdk['readyCalls']).toBe(1);
    expect(sdk['titleVisibleAtReady']).toBe(true);
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

/**
 * Проверка самого стража ошибок: эти тесты ОБЯЗАНЫ упасть (test.fail).
 * Если страж перестанет замечать сбои загрузки, они «пройдут» и Playwright сообщит об ошибке.
 */
test.describe('страж ошибок загрузки', () => {
  test('отсутствующий файл (404) роняет тест', async ({ page }) => {
    test.fail();
    await page.goto('/');
    await waitForReady(page);
    await page.evaluate(async () => {
      const image = new Image();
      image.src = './assets/missing-illustration.png';
      document.body.append(image);
      await new Promise((resolve) => {
        image.onerror = resolve;
        image.onload = resolve;
      });
    });
  });

  test('сорванная загрузка ресурса роняет тест', async ({ page }) => {
    test.fail();
    await page.route('**/*.css', (route) => route.abort('failed'));
    await page.goto('/');
    await waitForReady(page);
  });
});
