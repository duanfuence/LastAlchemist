import type { Page, TestInfo } from '@playwright/test';
import { expect, press, test } from './fixtures';
import {
  SAVE_KEY,
  boardItems,
  boardPoint,
  expectNoHorizontalOverflow,
  medalCenter,
  mouseDrag,
  openLab,
  touchDrag,
  waitForSaved,
} from './game-helpers';

const touchOnly = (testInfo: { project: { use: { hasTouch?: boolean } } }) => Boolean(testInfo.project.use.hasTouch);

test.describe('лаборатория', () => {
  test('открывается с четырьмя стихиями, счётчиком и пустым столом', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    for (const id of ['water', 'fire', 'earth', 'air']) {
      await expect(page.getByTestId(`catalog-${id}`)).toBeVisible();
    }
    await expect(page.locator('.catalog-item')).toHaveCount(4);
    await expect(page.getByTestId('discovery-count')).toHaveText('0 из 27');
    await expect(boardItems(page)).toHaveCount(0);
    await expect(page.getByTestId('coach')).toContainText('Перенесите стихию «Вода» на стол');
    await expectNoHorizontalOverflow(page);
  });

  test('цепочка открытий перетаскиванием мышью: Вода + Огонь = Пар, Пар + Воздух = Облако', async ({
    page,
  }, testInfo) => {
    test.skip(touchOnly(testInfo), 'мышь проверяется на компьютерных профилях');
    await openLab(page, testInfo);

    await mouseDrag(page, page.getByTestId('catalog-water'), await boardPoint(page, 0.4, 0.4));
    await expect(boardItems(page, 'water')).toHaveCount(1);

    await mouseDrag(page, page.getByTestId('catalog-fire'), await medalCenter(boardItems(page, 'water')));
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await expect(boardItems(page)).toHaveCount(1);
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'discovery');
    await expect(page.getByTestId('toast')).toContainText('Пар');
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');
    await expect(page.getByTestId('catalog-steam')).toBeVisible();

    // Полученный элемент участвует в следующей комбинации
    await mouseDrag(page, page.getByTestId('catalog-air'), await medalCenter(boardItems(page, 'steam')));
    await expect(boardItems(page, 'cloud')).toHaveCount(1);
    await expect(page.getByTestId('discovery-count')).toHaveText('2 из 27');
    await expect(page.getByTestId('board-caption')).toContainText('Облако');

    // Порядок не важен: элемент стола на элемент списка, перенесённый на стол
    await mouseDrag(page, page.getByTestId('catalog-earth'), await boardPoint(page, 0.2, 0.2));
    await mouseDrag(page, page.getByTestId('catalog-fire'), await boardPoint(page, 0.75, 0.2));
    await mouseDrag(page, boardItems(page, 'earth'), await medalCenter(boardItems(page, 'fire')));
    await expect(boardItems(page, 'lava')).toHaveCount(1);
    await expect(page.getByTestId('discovery-count')).toHaveText('3 из 27');
  });

  test('повторное получение известного элемента не увеличивает счётчик', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    const combineByTaps = async () => {
      await press(page.getByTestId('catalog-fire'), testInfo);
      await press(boardItems(page, 'fire').last(), testInfo);
      await press(page.getByTestId('catalog-water'), testInfo);
    };

    await combineByTaps();
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'discovery');
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');

    await combineByTaps();
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'known');
    await expect(page.getByTestId('toast')).toContainText('Вы уже знаете этот рецепт');
    await expect(page.getByTestId('board-caption')).toContainText('Рецепт уже известен');
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');
    // Участники израсходованы, второго Пара на столе нет, анимации открытия нет
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await expect(boardItems(page)).toHaveCount(1);
    await expect(page.locator('.board-item.is-discovery')).toHaveCount(0);
    await expect(page.locator('.catalog-item[data-element="steam"]')).toHaveCount(1);
  });

  test('без рецепта элементы остаются на месте, игрок видит пояснение', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    await press(page.getByTestId('catalog-fire'), testInfo);
    await press(page.getByTestId('catalog-fire'), testInfo);
    const fires = boardItems(page, 'fire');
    await expect(fires).toHaveCount(2);
    await press(fires.nth(0), testInfo);
    await press(fires.nth(1), testInfo);
    await expect(page.getByTestId('board-caption')).toHaveText('Огонь и Огонь не соединяются.');
    await expect(fires).toHaveCount(2);
    await expect(page.getByTestId('discovery-count')).toHaveText('0 из 27');
  });

  test('быстрый рывок мышью не теряет перенос', async ({ page }, testInfo) => {
    test.skip(touchOnly(testInfo), 'мышь проверяется на компьютерных профилях');
    await openLab(page, testInfo);
    // Два шага: первое же движение уходит далеко за пределы элемента списка
    await mouseDrag(page, page.getByTestId('catalog-air'), await boardPoint(page, 0.3, 0.35), 2);
    await expect(boardItems(page, 'air')).toHaveCount(1);
    await mouseDrag(page, page.getByTestId('catalog-earth'), await medalCenter(boardItems(page, 'air')), 2);
    await expect(boardItems(page, 'dust')).toHaveCount(1);
    await mouseDrag(page, boardItems(page, 'dust'), await boardPoint(page, 0.7, 0.6), 2);
    const at = await medalCenter(boardItems(page, 'dust'));
    const target = await boardPoint(page, 0.7, 0.6);
    expect(Math.hypot(at.x - target.x, at.y - target.y)).toBeLessThan(6);
  });

  test('элемент перемещается по столу мышью', async ({ page }, testInfo) => {
    test.skip(touchOnly(testInfo), 'мышь проверяется на компьютерных профилях');
    await openLab(page, testInfo);
    await mouseDrag(page, page.getByTestId('catalog-earth'), await boardPoint(page, 0.3, 0.3));
    const earth = boardItems(page, 'earth');
    const before = await medalCenter(earth);
    const target = await boardPoint(page, 0.7, 0.6);
    await mouseDrag(page, earth, target);
    const after = await medalCenter(earth);
    expect(Math.abs(after.x - target.x)).toBeLessThan(6);
    expect(Math.abs(after.y - target.y)).toBeLessThan(6);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(50);
  });
});

test.describe('сенсорное управление', () => {
  test('выбор первого и второго элемента касанием', async ({ page }, testInfo) => {
    test.skip(!touchOnly(testInfo), 'касания проверяются на сенсорных профилях');
    await openLab(page, testInfo);

    // Касание элемента списка кладёт его на стол
    await page.getByTestId('catalog-water').tap();
    await page.getByTestId('catalog-earth').tap();
    await expect(boardItems(page)).toHaveCount(2);

    // Выбор на столе, затем второй элемент на столе
    await boardItems(page, 'water').tap();
    await expect(boardItems(page, 'water')).toHaveClass(/is-selected/);
    await expect(page.getByTestId('board-caption')).toContainText('Выберите второй элемент');
    await boardItems(page, 'earth').tap();
    await expect(boardItems(page, 'mud')).toHaveCount(1);
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');

    // Выбор на столе, затем элемент из списка
    await boardItems(page, 'mud').tap();
    await page.getByTestId('catalog-fire').tap();
    await expect(boardItems(page, 'brick')).toHaveCount(1);
    await expect(page.getByTestId('discovery-count')).toHaveText('2 из 27');

    // Повторное касание снимает выбор
    await boardItems(page, 'brick').tap();
    await boardItems(page, 'brick').tap();
    await expect(boardItems(page, 'brick')).not.toHaveClass(/is-selected/);
  });

  test('касание сразу после переноса пальцем не теряется', async ({ page }, testInfo) => {
    test.skip(!touchOnly(testInfo), 'касания проверяются на сенсорных профилях');
    await openLab(page, testInfo);
    // Резкий бросок: без защиты браузер запускал инерцию прокрутки ленты, и следующее касание гасило её
    await touchDrag(page, page.getByTestId('catalog-water'), await boardPoint(page, 0.5, 0.3));
    await press(boardItems(page, 'water'), testInfo);
    await expect(boardItems(page, 'water')).toHaveClass(/is-selected/);
    await press(page.getByTestId('catalog-fire'), testInfo);
    await expect(boardItems(page, 'steam')).toHaveCount(1);
  });

  test('перетаскивание пальцем из ленты на стол и на другой элемент', async ({ page }, testInfo) => {
    test.skip(!touchOnly(testInfo), 'касания проверяются на сенсорных профилях');
    await openLab(page, testInfo);
    await touchDrag(page, page.getByTestId('catalog-water'), await boardPoint(page, 0.6, 0.35));
    await expect(boardItems(page, 'water')).toHaveCount(1);
    await touchDrag(page, page.getByTestId('catalog-fire'), await medalCenter(boardItems(page, 'water')));
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');
    // Перемещение пальцем по столу
    const target = await boardPoint(page, 0.3, 0.6);
    await touchDrag(page, boardItems(page, 'steam'), target);
    const at = await medalCenter(boardItems(page, 'steam'));
    expect(Math.hypot(at.x - target.x, at.y - target.y)).toBeLessThan(8);
  });
});

test.describe('удаление и управление столом', () => {
  test('элемент убирается кнопкой, клавишей Delete, переносом в список и очисткой стола', async ({
    page,
  }, testInfo) => {
    await openLab(page, testInfo);
    for (const id of ['water', 'fire', 'earth', 'air']) await press(page.getByTestId(`catalog-${id}`), testInfo);
    await expect(boardItems(page)).toHaveCount(4);

    await press(boardItems(page, 'water'), testInfo);
    await press(page.getByTestId('remove-selected'), testInfo);
    await expect(boardItems(page, 'water')).toHaveCount(0);
    await expect(page.getByTestId('board-caption')).toContainText('Убрано со стола: Вода');

    await boardItems(page, 'fire').focus();
    await page.keyboard.press('Delete');
    await expect(boardItems(page, 'fire')).toHaveCount(0);

    if (!touchOnly(testInfo)) {
      await mouseDrag(page, boardItems(page, 'earth'), await medalCenter(page.getByTestId('catalog-air')));
      await expect(boardItems(page, 'earth')).toHaveCount(0);
    }

    await press(page.getByTestId('clear-board'), testInfo);
    await expect(boardItems(page)).toHaveCount(0);
    await expect(page.getByTestId('discovery-count')).toHaveText('0 из 27');
  });

  test('управление с клавиатуры', async ({ page }, testInfo) => {
    test.skip(touchOnly(testInfo), 'клавиатура проверяется на компьютерных профилях');
    await openLab(page, testInfo);
    await page.getByTestId('catalog-water').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('catalog-fire').focus();
    await page.keyboard.press('Enter');
    await expect(boardItems(page)).toHaveCount(2);

    const water = boardItems(page, 'water');
    const before = await medalCenter(water);
    await water.focus();
    await page.keyboard.press('Shift+ArrowLeft');
    expect((await medalCenter(water)).x).toBeLessThan(before.x);

    await page.keyboard.press('Enter');
    await expect(water).toHaveClass(/is-selected/);
    await page.keyboard.press('Escape');
    await expect(water).not.toHaveClass(/is-selected/);

    await page.keyboard.press('Enter');
    await boardItems(page, 'fire').focus();
    await page.keyboard.press('Enter');
    await expect(boardItems(page, 'steam')).toHaveCount(1);
  });
});

test.describe('альтернативные рецепты', () => {
  /** Соединение касаниями: элемент списка на стол, выбор его, затем второй элемент из списка. */
  const combineFromCatalog = async (page: Page, testInfo: TestInfo, first: string, second: string) => {
    await press(page.getByTestId(`catalog-${first}`), testInfo);
    await press(boardItems(page, first).last(), testInfo);
    await press(page.getByTestId(`catalog-${second}`), testInfo);
  };

  test('альтернативный рецепт записывается без второго экземпляра и переживает перезагрузку', async ({
    page,
  }, testInfo) => {
    await openLab(page, testInfo);
    await combineFromCatalog(page, testInfo, 'air', 'water');
    await expect(boardItems(page, 'rain')).toHaveCount(1);
    await combineFromCatalog(page, testInfo, 'water', 'fire');
    await combineFromCatalog(page, testInfo, 'steam', 'air');
    await expect(page.getByTestId('discovery-count')).toHaveText('3 из 27');
    const itemsBefore = await boardItems(page).count();

    // Облако + Вода — другой путь к уже открытому Дождю
    await press(page.getByTestId('catalog-cloud'), testInfo);
    await press(boardItems(page, 'cloud').last(), testInfo);
    await press(page.getByTestId('catalog-water'), testInfo);
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'new-recipe');
    await expect(page.getByTestId('toast')).toContainText('Найден альтернативный рецепт');
    await expect(page.getByTestId('board-caption')).toContainText('Новый рецепт записан');
    await expect(boardItems(page, 'rain')).toHaveCount(1);
    await expect(boardItems(page)).toHaveCount(itemsBefore);
    await expect(page.locator('.board-item.is-discovery')).toHaveCount(0);
    await expect(page.getByTestId('discovery-count')).toHaveText('3 из 27');
    await waitForSaved(page, '"cloud|water"');

    // Известный элемент по-прежнему берётся из списка и участвует в других соединениях
    await combineFromCatalog(page, testInfo, 'rain', 'earth');
    await expect(boardItems(page, 'plant')).toHaveCount(1);
    await expect(page.getByTestId('discovery-count')).toHaveText('4 из 27');
    await waitForSaved(page, '"plant"');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await press(page.getByTestId('open-book'), testInfo);
    await expect(page.getByTestId('discovery-count')).toHaveText('4 из 27');
    await expect(boardItems(page, 'rain')).toHaveCount(1);
    await combineFromCatalog(page, testInfo, 'cloud', 'water');
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'known');
    await expect(page.getByTestId('toast')).toContainText('Вы уже знаете этот рецепт');
    await expect(boardItems(page, 'rain')).toHaveCount(1);
  });

  test('повторное соединение перетаскиванием расходует участников', async ({ page }, testInfo) => {
    test.skip(Boolean(testInfo.project.use.hasTouch), 'мышь проверяется на компьютерных профилях');
    await openLab(page, testInfo);
    await mouseDrag(page, page.getByTestId('catalog-air'), await boardPoint(page, 0.3, 0.3));
    await mouseDrag(page, page.getByTestId('catalog-earth'), await medalCenter(boardItems(page, 'air')));
    await expect(boardItems(page, 'dust')).toHaveCount(1);

    await mouseDrag(page, page.getByTestId('catalog-earth'), await boardPoint(page, 0.7, 0.6));
    await mouseDrag(page, page.getByTestId('catalog-air'), await medalCenter(boardItems(page, 'earth')));
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'known');
    await expect(boardItems(page, 'earth')).toHaveCount(0);
    await expect(boardItems(page, 'dust')).toHaveCount(1);
    await expect(boardItems(page)).toHaveCount(1);
  });
});

test.describe('сохранение', () => {
  test('после перезагрузки открытия, счётчик и стол сохраняются', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    await press(page.getByTestId('catalog-fire'), testInfo);
    await press(boardItems(page, 'fire'), testInfo);
    await press(page.getByTestId('catalog-water'), testInfo);
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await press(page.getByTestId('catalog-air'), testInfo);
    await waitForSaved(page, '"steam"');
    const steamBefore = await medalCenter(boardItems(page, 'steam'));

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await press(page.getByTestId('open-book'), testInfo);
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');
    await expect(page.getByTestId('catalog-steam')).toBeVisible();
    await expect(boardItems(page, 'steam')).toHaveCount(1);
    await expect(boardItems(page, 'air')).toHaveCount(1);
    await expect(page.locator('.page__content')).not.toHaveClass(/is-entering|is-leaving/);
    const steamAfter = await medalCenter(boardItems(page, 'steam'));
    expect(Math.hypot(steamAfter.x - steamBefore.x, steamAfter.y - steamBefore.y)).toBeLessThan(3);

    // Повторное открытие после перезагрузки не увеличивает счётчик
    await press(page.getByTestId('catalog-water'), testInfo);
    await press(boardItems(page, 'water'), testInfo);
    await press(page.getByTestId('catalog-fire'), testInfo);
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'known');
    await expect(page.getByTestId('discovery-count')).toHaveText('1 из 27');
  });

  test('повреждённое сохранение не блокирует игру и объясняется игроку', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, '{"v":1,"discovered":[повреждено'), SAVE_KEY);
    await page.reload();
    await expect(page.getByTestId('notice')).toContainText('Записи книги повреждены');
    const backup = await page.evaluate(() => localStorage.getItem('last-alchemist:save:corrupted-backup'));
    expect(backup).toBe('{"v":1,"discovered":[повреждено');

    await press(page.getByTestId('open-book'), testInfo);
    await press(page.getByTestId('catalog-water'), testInfo);
    await press(boardItems(page, 'water'), testInfo);
    await press(page.getByTestId('catalog-water'), testInfo);
    await expect(boardItems(page, 'sea')).toHaveCount(1);
    await waitForSaved(page, '"sea"');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as unknown, SAVE_KEY);
    expect(saved).toMatchObject({ v: 1, discovered: expect.arrayContaining(['sea']) });
  });
});

test.describe('раскладка лаборатории', () => {
  test('нет горизонтального переполнения при полном столе и развёрнутом списке', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    for (let i = 0; i < 12; i += 1) {
      await press(page.getByTestId(`catalog-${['water', 'fire', 'earth', 'air'][i % 4]}`), testInfo);
    }
    await expect(boardItems(page)).toHaveCount(12);
    await expectNoHorizontalOverflow(page);

    // Все элементы целиком внутри стола
    const outside = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="board"]')!.getBoundingClientRect();
      return [...document.querySelectorAll('.board-item .medal')].filter((medal) => {
        const r = medal.getBoundingClientRect();
        return r.left < board.left - 1 || r.right > board.right + 1 || r.top < board.top - 1 || r.bottom > board.bottom + 1;
      }).length;
    });
    expect(outside).toBe(0);

    const toggle = page.getByTestId('catalog-toggle');
    if (await toggle.isVisible()) {
      await press(toggle, testInfo);
      await expect(page.getByTestId('catalog')).toHaveAttribute('data-expanded', '');
      await expectNoHorizontalOverflow(page);
    }
  });

  test('из лаборатории можно вернуться к титулу и снова открыть книгу', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    await press(page.getByTestId('catalog-earth'), testInfo);
    await press(page.getByTestId('lab-back'), testInfo);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Книга последнего алхимика');
    await press(page.getByTestId('open-book'), testInfo);
    await expect(boardItems(page, 'earth')).toHaveCount(1);
  });
});
