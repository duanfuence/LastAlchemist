import { PauseState, type Platform, type VisibilitySource } from '../Platform';

/** Платформа для разработки, тестов и запуска без SDK Яндекс Игр. */
export class LocalPlatform implements Platform {
  readonly kind = 'local';
  /** Вне площадки язык берётся из документа (см. main.ts). */
  readonly language = null;
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

  get paused(): boolean {
    return this.pause.paused;
  }

  onPauseChange(listener: (paused: boolean) => void): () => void {
    return this.pause.subscribe(listener);
  }
}
