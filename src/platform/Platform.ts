/**
 * Граница между игрой и площадкой публикации.
 * Игра обращается к SDK только через этот интерфейс, поэтому запускается и тестируется без него.
 */

export type PlatformKind = 'local' | 'yandex';

export type PauseListener = (paused: boolean) => void;

export interface Platform {
  readonly kind: PlatformKind;
  /**
   * Сообщает площадке, что игра загружена и готова к взаимодействию.
   * Повторные вызовы игнорируются.
   */
  gameReady(): void;
  /** Подписка на паузу (скрытие вкладки, пауза от площадки). Возвращает функцию отписки. */
  onPauseChange(listener: PauseListener): () => void;
}

/** Минимум от document, нужный для отслеживания видимости вкладки. */
export interface VisibilitySource {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Объединяет несколько причин паузы (вкладка скрыта, пауза площадки)
 * и сообщает подписчикам только об изменении итогового состояния.
 */
export class PauseState {
  private readonly reasons = new Set<string>();
  private readonly listeners = new Set<PauseListener>();

  get paused(): boolean {
    return this.reasons.size > 0;
  }

  set(reason: string, active: boolean): void {
    const before = this.paused;
    if (active) this.reasons.add(reason);
    else this.reasons.delete(reason);
    if (this.paused !== before) {
      for (const listener of this.listeners) listener(this.paused);
    }
  }

  subscribe(listener: PauseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  trackVisibility(source: VisibilitySource): void {
    this.set('hidden', source.hidden);
    source.addEventListener('visibilitychange', () => this.set('hidden', source.hidden));
  }
}
