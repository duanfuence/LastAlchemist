import { LocalPlatform } from './local/LocalPlatform';
import type { Platform, PlatformKind, VisibilitySource } from './Platform';
import { YandexPlatform, type YandexSdk } from './yandex/YandexPlatform';

export type { Platform, PlatformKind } from './Platform';

export interface PlatformOptions {
  /** Цель сборки: 'yandex' — сборка для Яндекс Игр, 'local' — разработка. */
  target: PlatformKind;
  /** Глобальный объект, в котором /sdk.js объявляет YaGames. */
  globalScope?: object;
  visibility?: VisibilitySource;
  warn?: (message: string, error?: unknown) => void;
  /** Сколько ждать инициализации SDK, прежде чем продолжить без него (мс). */
  initTimeoutMs?: number;
}

/** Игра ждёт SDK перед первым показом (язык нужен до текста), но не бесконечно. */
export const SDK_INIT_TIMEOUT_MS = 6000;

interface YaGamesLoader {
  init(): Promise<YandexSdk>;
}

function findYaGames(scope: object): YaGamesLoader | undefined {
  const candidate = (scope as { YaGames?: unknown }).YaGames;
  if (candidate && typeof (candidate as YaGamesLoader).init === 'function') {
    return candidate as YaGamesLoader;
  }
  return undefined;
}

/**
 * Создаёт платформу. Если SDK недоступен (игра открыта вне Яндекс Игр, сбой загрузки),
 * игра продолжает работать на локальной платформе: SDK не должен блокировать алхимию.
 */
export async function createPlatform(options: PlatformOptions): Promise<Platform> {
  const { target, globalScope = globalThis, visibility, warn = console.warn, initTimeoutMs = SDK_INIT_TIMEOUT_MS } = options;
  if (target !== 'yandex') return new LocalPlatform(visibility);

  const loader = findYaGames(globalScope);
  if (!loader) {
    warn('SDK Яндекс Игр не найден, игра запущена без него.');
    return new LocalPlatform(visibility);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`SDK не ответил за ${initTimeoutMs} мс`)), initTimeoutMs);
  });
  try {
    const sdk = await Promise.race([loader.init(), timeout]);
    return new YandexPlatform(sdk, visibility);
  } catch (error) {
    warn('Не удалось инициализировать SDK Яндекс Игр, игра запущена без него.', error);
    return new LocalPlatform(visibility);
  } finally {
    clearTimeout(timer);
  }
}
