import type { Locator, Page, TestInfo } from '@playwright/test';

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

/** Ошибки консоли, кроме ожидаемых (отсутствие /sdk.js вне площадки). */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/sdk\.js|404|Failed to load resource/i.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
