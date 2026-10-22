import type { SDK } from 'ysdk';
import { PauseState, type Platform, type VisibilitySource } from '../Platform';

/**
 * Адаптер SDK Яндекс Игр. Используются только методы, описанные в официальной документации:
 * - LoadingAPI.ready() — игра готова к взаимодействию;
 * - события game_api_pause / game_api_resume.
 * https://yandex.com/dev/games/doc/en/sdk/sdk-game-events
 */
export type YandexSdk = Pick<SDK, 'on' | 'features'>;

export class YandexPlatform implements Platform {
  readonly kind = 'yandex';
  private readonly pause = new PauseState();
  private readySent = false;

  constructor(
    private readonly sdk: YandexSdk,
    visibility?: VisibilitySource,
  ) {
    sdk.on('game_api_pause', () => this.pause.set('platform', true));
    sdk.on('game_api_resume', () => this.pause.set('platform', false));
    if (visibility) this.pause.trackVisibility(visibility);
  }

  gameReady(): void {
    if (this.readySent) return;
    this.readySent = true;
    this.sdk.features.LoadingAPI.ready();
  }

  onPauseChange(listener: (paused: boolean) => void): () => void {
    return this.pause.subscribe(listener);
  }
}
