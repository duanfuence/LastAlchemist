import type { SDK } from 'ysdk';
import { PauseState, type Platform, type VisibilitySource } from '../Platform';

/**
 * Адаптер SDK Яндекс Игр. Используются только методы, описанные в официальной документации:
 * - LoadingAPI.ready() — игра готова к взаимодействию;
 * - события game_api_pause / game_api_resume;
 * - environment.i18n.lang — язык интерфейса площадки (требование 2.14: язык определяется через SDK).
 * https://yandex.com/dev/games/doc/en/sdk/sdk-game-events
 * https://yandex.com/dev/games/doc/en/sdk/sdk-environment
 */
export type YandexSdk = Pick<SDK, 'on' | 'features' | 'environment'>;

/** Язык площадки; при неожиданном ответе SDK — null, и игра выбирает язык по умолчанию. */
function readLanguage(sdk: YandexSdk): string | null {
  try {
    const lang: unknown = sdk.environment.i18n.lang;
    return typeof lang === 'string' && lang !== '' ? lang : null;
  } catch {
    return null;
  }
}

export class YandexPlatform implements Platform {
  readonly kind = 'yandex';
  readonly language: string | null;
  private readonly pause = new PauseState();
  private readySent = false;

  constructor(
    private readonly sdk: YandexSdk,
    visibility?: VisibilitySource,
  ) {
    this.language = readLanguage(sdk);
    sdk.on('game_api_pause', () => this.pause.set('platform', true));
    sdk.on('game_api_resume', () => this.pause.set('platform', false));
    if (visibility) this.pause.trackVisibility(visibility);
  }

  gameReady(): void {
    if (this.readySent) return;
    this.readySent = true;
    this.sdk.features.LoadingAPI.ready();
  }

  get paused(): boolean {
    return this.pause.paused;
  }

  onPauseChange(listener: (paused: boolean) => void): () => void {
    return this.pause.subscribe(listener);
  }
}
