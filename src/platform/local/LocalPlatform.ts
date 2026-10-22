import { PauseState, type Platform, type VisibilitySource } from '../Platform';

/** Платформа для разработки, тестов и запуска без SDK Яндекс Игр. */
export class LocalPlatform implements Platform {
  readonly kind = 'local';
  private readonly pause = new PauseState();
  private ready = false;

  constructor(visibility?: VisibilitySource) {
    if (visibility) this.pause.trackVisibility(visibility);
  }

  get isReady(): boolean {
    return this.ready;
  }

  gameReady(): void {
    this.ready = true;
  }

  onPauseChange(listener: (paused: boolean) => void): () => void {
    return this.pause.subscribe(listener);
  }
}
