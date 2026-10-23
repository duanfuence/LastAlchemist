import type { Page, TestInfo } from '@playwright/test';
import { expect, press, test } from './fixtures';
import { SAVE_KEY, boardItems, expectNoHorizontalOverflow, openLab } from './game-helpers';

const ALL = [
  'water', 'fire', 'earth', 'air', 'steam', 'mud', 'lava', 'energy', 'rain', 'dust', 'wind', 'sea', 'cloud', 'storm', 'plant',
  'swamp', 'life', 'volcano', 'ash', 'stone', 'metal', 'sand', 'glass', 'brick', 'salt', 'sulfur', 'mercury', 'gunpowder',
  'explosion', 'hourglass', 'cinnabar', 'homunculus',
];
const REGULAR = ALL.filter((id) => id !== 'homunculus');

async function openWith(page: Page, testInfo: TestInfo, discovered: string[], extra: Record<string, unknown> = {}): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify({ v: 1, savedAt: 1, discovered, recipes: [], board: [], ...extra })] as const,
  );
  await openLab(page, testInfo);
}

const suggested = (page: Page) => page.locator('.catalog-item.is-suggested').evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset['element'] ?? ''));
const caption = (page: Page) => page.getByTestId('board-caption');

/** Соединяет два элемента касаниями: первый кладётся из списка и выбирается, второй — из списка. */
async function combineFromCatalog(page: Page, testInfo: TestInfo, first: string, second: string): Promise<void> {
  await press(page.getByTestId(`catalog-${first}`), testInfo);
  await press(boardItems(page, first).last(), testInfo);
  await press(page.getByTestId(`catalog-${second}`), testInfo);
}

test.describe('подсказки', () => {
  test('первое нажатие называет один ингредиент, второе — пару; пара даёт новое открытие', async ({ page }, testInfo) => {
    await openLab(page, testInfo);
    const counter = page.getByTestId('discovery-count');
    await expect(counter).toHaveText('0 из 27');
    // В самом начале подсветку держит записка первого опыта; подсказка ведёт к тому же открытию
    await press(page.getByTestId('hint'), testInfo);
    await expect(caption(page)).toContainText(/участвует «(Вода|Огонь)»/);

    await press(page.getByTestId('hint'), testInfo);
    await expect(caption(page)).toContainText(/соедините «(Вода|Огонь)» и «(Вода|Огонь)»/);
    const pair = await suggested(page);
    expect(pair.sort()).toEqual(['fire', 'water']);
    expect(pair.length).toBeGreaterThanOrEqual(1);
    const [first, second = first] = pair as [string, string?];
    await combineFromCatalog(page, testInfo, first, second);
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'discovery');
    await expect(counter).toHaveText('1 из 27');
    // Подсказка выполнена: подсветка снята, подпись вернулась к обычной
    await expect.poll(() => suggested(page)).toEqual([]);
    await expect(caption(page)).not.toContainText('пометка', { timeout: 6000 });
  });

  test('середина книги: подсказка ведёт к неоткрытому, а не к известному рецепту', async ({ page }, testInfo) => {
    await openWith(page, testInfo, ['water', 'fire', 'earth', 'air', 'steam', 'mud', 'lava', 'energy', 'rain', 'dust', 'sea', 'stone', 'cloud']);
    await press(page.getByTestId('hint'), testInfo);
    // Первый шаг — ровно один подсвеченный ингредиент
    expect(await suggested(page)).toHaveLength(1);
    await press(page.getByTestId('hint'), testInfo);
    const pair = await suggested(page);
    const [first, second = first] = pair as [string, string?];
    await combineFromCatalog(page, testInfo, first, second);
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'discovery');
    await expect(page.getByTestId('discovery-count')).toHaveText('10 из 27');
  });

  test('почти полная книга: подсказка ведёт к последнему обычному элементу, а не к тайному', async ({ page }, testInfo) => {
    await openWith(page, testInfo, REGULAR.filter((id) => id !== 'cinnabar'));
    await press(page.getByTestId('hint'), testInfo);
    await press(page.getByTestId('hint'), testInfo);
    expect((await suggested(page)).sort()).toEqual(['mercury', 'sulfur']);
    await expect(caption(page)).not.toContainText('Гомункул');
  });

  test('вся книга открыта: подсказывать больше нечего', async ({ page }, testInfo) => {
    await openWith(page, testInfo, ALL);
    await press(page.getByTestId('hint'), testInfo);
    await expect(caption(page)).toContainText('Подсказывать больше нечего');
    expect(await suggested(page)).toEqual([]);
  });

  test('кнопка подсказки помещается в шапку списка без переносов и переполнения', async ({ page }, testInfo) => {
    await openWith(page, testInfo, ALL.slice(0, 14));
    const head = await page.locator('.catalog__head').boundingBox();
    const hint = await page.getByTestId('hint').boundingBox();
    expect(hint).not.toBeNull();
    // Подсказка и «Все элементы» в одной строке с заголовком
    expect(head!.height).toBeLessThan(52);
    const toggle = page.getByTestId('catalog-toggle');
    if (await toggle.isVisible()) {
      const box = await toggle.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(head!.x + head!.width + 1);
    }
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('исследованные элементы', () => {
  test('элемент без новых открытий отмечен в списке и объяснён при выборе', async ({ page }, testInfo) => {
    await openWith(page, testInfo, ['water', 'fire', 'earth', 'air', 'wind']);
    await expect(page.getByTestId('catalog-wind')).toHaveClass(/is-explored/);
    await expect(page.getByTestId('catalog-water')).not.toHaveClass(/is-explored/);
    await press(page.getByTestId('catalog-wind'), testInfo);
    await press(boardItems(page, 'wind'), testInfo);
    await expect(caption(page)).toContainText('больше ничего нового не получить');
  });

  test('открытие, исчерпавшее элемент, сообщает об этом', async ({ page }, testInfo) => {
    // Пар: единственный рецепт Пар + Воздух = Облако. После Облака Пар исследован
    await openWith(page, testInfo, ['water', 'fire', 'earth', 'air', 'steam']);
    await expect(page.getByTestId('catalog-steam')).not.toHaveClass(/is-explored/);
    await combineFromCatalog(page, testInfo, 'steam', 'air');
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'discovery');
    await expect(page.getByTestId('catalog-steam')).toHaveClass(/is-explored/);
    await expect(caption(page)).toContainText('исследован полностью');
  });
});

test.describe('сюжетные записи', () => {
  const story = (page: Page) => page.getByTestId('story');

  test('последний обычный опыт открывает запись один раз; перезагрузка и повтор её не вызывают', async ({ page }, testInfo) => {
    await openWith(page, testInfo, REGULAR.filter((id) => id !== 'cinnabar'));
    await combineFromCatalog(page, testInfo, 'mercury', 'sulfur');
    await expect(story(page)).toBeVisible({ timeout: 5000 });
    await expect(story(page)).toHaveAttribute('data-entry', 'research');
    await expect(story(page)).toContainText('Книга заполнена');
    // Запись помещается на экран целиком, кнопка видна без прокрутки
    await expect(page.getByTestId('story-close')).toBeInViewport();
    await expectNoHorizontalOverflow(page);
    await press(page.getByTestId('story-close'), testInfo);
    await expect(story(page)).toHaveCount(0);

    // Повтор известного рецепта — без записи
    await combineFromCatalog(page, testInfo, 'mercury', 'sulfur');
    await expect(page.getByTestId('toast')).toHaveAttribute('data-kind', 'known');
    await page.waitForTimeout(2000);
    await expect(story(page)).toHaveCount(0);

    await openLab(page, testInfo);
    await page.waitForTimeout(2000);
    await expect(story(page)).toHaveCount(0);
  });

  test('Гомункул после всей книги открывает финал; титул говорит, что рукопись дописана, записи можно перечитать', async ({ page }, testInfo) => {
    await openWith(page, testInfo, REGULAR, { story: ['research'] });
    await combineFromCatalog(page, testInfo, 'life', 'mercury');
    await expect(story(page)).toHaveAttribute('data-entry', 'final', { timeout: 5000 });
    await expect(story(page)).toContainText('Конец рукописи');
    await expect(story(page).locator('img')).toHaveCount(1);
    await press(page.getByTestId('story-close'), testInfo);

    await press(page.getByTestId('lab-back'), testInfo);
    await expect(page.locator('.hand-note')).toContainText('Рукопись дописана');
    await press(page.getByTestId('story-reread'), testInfo);
    await expect(story(page)).toHaveAttribute('data-entry', 'research');
    await press(page.getByTestId('story-next'), testInfo);
    await expect(story(page)).toHaveAttribute('data-entry', 'final');
    await page.keyboard.press('Escape');
    await expect(story(page)).toHaveCount(0);
    await expect(page.getByTestId('open-book')).toBeVisible();
  });

  test('Гомункул найден раньше: обе записи идут подряд после последнего обычного опыта', async ({ page }, testInfo) => {
    await openWith(page, testInfo, ALL.filter((id) => id !== 'cinnabar'));
    await combineFromCatalog(page, testInfo, 'mercury', 'sulfur');
    await expect(story(page)).toHaveAttribute('data-entry', 'research', { timeout: 5000 });
    await press(page.getByTestId('story-next'), testInfo);
    await expect(story(page)).toHaveAttribute('data-entry', 'final');
    await press(page.getByTestId('story-close'), testInfo);
    await expect(story(page)).toHaveCount(0);
  });

  test('заполненная книга из прежней версии: запись не всплывает, но её можно перечитать', async ({ page }, testInfo) => {
    await openWith(page, testInfo, ALL);
    await page.waitForTimeout(2000);
    await expect(story(page)).toHaveCount(0);
    await press(page.getByTestId('lab-back'), testInfo);
    await expect(page.getByTestId('story-reread')).toBeVisible();
    await expect(page.locator('.hand-note')).toContainText('Рукопись дописана');
  });

  test('пока записей нет, на титуле нет ссылки для перечитывания', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByTestId('story-reread')).toHaveCount(0);
    await expect(page.locator('.hand-note')).toContainText('Всё начинается');
  });
});
