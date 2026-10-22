import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * Единственный ожидаемый сбой загрузки: /sdk.js отдаёт только площадка Яндекс Игр,
 * при локальном просмотре сборки его нет. Любой другой 404 или сбой загрузки — ошибка.
 */
export function isExpectedLoadFailure(url: string): boolean {
  try {
    return new URL(url).pathname === '/sdk.js';
  } catch {
    return false;
  }
}

const SUBRESOURCE_TYPES = new Set(['image', 'stylesheet', 'script', 'font', 'media']);

/**
 * Страж ошибок: подключается к каждому тесту автоматически и роняет его,
 * если были ошибки консоли, исключения или сбои загрузки ресурсов.
 */
export const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const url = message.location().url;
        if (/^Failed to load resource/.test(message.text()) && isExpectedLoadFailure(url)) return;
        problems.push(`console.error: ${message.text()} ${url}`.trim());
      });
      page.on('pageerror', (error) => problems.push(`исключение: ${error.message}`));
      page.on('requestfailed', (request) => {
        if (isExpectedLoadFailure(request.url())) return;
        problems.push(`сбой загрузки: ${request.url()} (${request.failure()?.errorText ?? 'нет описания'})`);
      });
      page.on('response', (response) => {
        if (isExpectedLoadFailure(response.url())) return;
        if (response.status() >= 400) {
          problems.push(`HTTP ${response.status()}: ${response.url()}`);
          return;
        }
        // Сервер с SPA-подменой отдаёт index.html вместо отсутствующего файла с кодом 200
        const type = response.request().resourceType();
        const contentType = response.headers()['content-type'] ?? '';
        if (SUBRESOURCE_TYPES.has(type) && contentType.includes('text/html')) {
          problems.push(`вместо ресурса (${type}) пришла HTML-страница: ${response.url()}`);
        }
      });

      await use(problems);

      expect(problems, 'ошибки консоли и загрузки ресурсов').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Тестовая заглушка /sdk.js. Повторяет только используемую часть официального API:
 * YaGames.init(), ysdk.on('game_api_pause' | 'game_api_resume'), features.LoadingAPI.ready().
 * Записывает вызовы в window.__sdk для проверок. Используется только в тестах.
 */
const SDK_STUB = `
  window.__sdk = { initCalls: 0, readyCalls: 0, titleVisibleAtReady: null, handlers: {} };
  window.YaGames = {
    init() {
      window.__sdk.initCalls += 1;
      return Promise.resolve({
        on(event, handler) { window.__sdk.handlers[event] = handler; return () => {}; },
        features: {
          LoadingAPI: {
            ready() {
              window.__sdk.readyCalls += 1;
              window.__sdk.titleVisibleAtReady = Boolean(document.querySelector('h1'));
            },
          },
        },
      });
    },
  };
`;

export async function stubYandexSdk(page: Page): Promise<void> {
  await page.route('**/sdk.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: SDK_STUB }),
  );
}

/** Нажатие так, как это делает пользователь устройства: касание на сенсорных, клик мышью на ПК. */
export async function press(locator: Locator, testInfo: TestInfo): Promise<void> {
  if (testInfo.project.use.hasTouch) await locator.tap();
  else await locator.click();
}
