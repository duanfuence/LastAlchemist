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
}

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
  const { target, globalScope = globalThis, visibility, warn = console.warn } = options;
  if (target !== 'yandex') return new LocalPlatform(visibility);

  const loader = findYaGames(globalScope);
  if (!loader) {
    warn('SDK Яндекс Игр не найден, игра запущена без него.');
    return new LocalPlatform(visibility);
  }
  try {
    const sdk = await loader.init();
    return new YandexPlatform(sdk, visibility);
  } catch (error) {
    warn('Не удалось инициализировать SDK Яндекс Игр, игра запущена без него.', error);
    return new LocalPlatform(visibility);
  }
}
