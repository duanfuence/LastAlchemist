/**
 * Звуки книги на Web Audio.
 *
 * - Аудиоконтекст создаётся только после первого жеста игрока (требование браузеров
 *   и правил площадки): до этого play() ничего не делает. Музыки нет.
 * - Звуки загружаются один раз; недоступный или повреждённый файл просто молчит —
 *   ошибка загрузки не прерывает игру и не попадает в консоль как сбой.
 * - Пауза площадки и скрытая вкладка приостанавливают контекст.
 * - Громкость и выключение звука хранятся отдельно от прогресса.
 */

export type SoundName = 'place' | 'react' | 'fail' | 'discover' | 'secret' | 'book';

export interface SoundSettings {
  muted: boolean;
  /** 0…1 */
  volume: number;
}

/** Сколько ждать загрузки звука, запрошенного раньше, чем он был готов (мс). */
const PENDING_MS = 500;

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { muted: false, volume: 0.7 };
export const SOUND_SETTINGS_KEY = 'last-alchemist:sound';

/** Минимум Web Audio, который нужен системе (позволяет подменить контекст в тестах). */
export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  createGain(): GainLike;
  createBufferSource(): SourceLike;
}

export interface GainLike {
  gain: { value: number };
  connect(target: unknown): unknown;
}

export interface SourceLike {
  buffer: unknown;
  playbackRate: { value: number };
  connect(target: unknown): unknown;
  start(when?: number): void;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SoundDeps {
  urls: Partial<Record<SoundName, string>>;
  createContext(): AudioContextLike | null;
  load(url: string): Promise<ArrayBuffer>;
  storage: StorageLike | null;
}

/** Громкость каждого звука относительно общей: частые звуки тише редких. */
const LEVEL: Record<SoundName, number> = {
  place: 0.45,
  react: 0.5,
  fail: 0.55,
  discover: 0.8,
  secret: 0.9,
  book: 0.55,
};

export function parseSoundSettings(raw: string | null): SoundSettings {
  if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_SOUND_SETTINGS };
    const record = data as Record<string, unknown>;
    const volume = typeof record['volume'] === 'number' && Number.isFinite(record['volume']) ? record['volume'] : DEFAULT_SOUND_SETTINGS.volume;
    return {
      muted: record['muted'] === true,
      volume: Math.min(1, Math.max(0, volume)),
    };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export class SoundSystem {
  private context: AudioContextLike | null = null;
  private master: GainLike | null = null;
  private readonly buffers = new Map<SoundName, unknown>();
  private readonly failed = new Set<SoundName>();
  private readonly listeners = new Set<(settings: SoundSettings) => void>();
  /** Загрузка файлов идёт заранее, без аудиоконтекста; декодирование — после первого жеста. */
  private readonly downloads = new Map<SoundName, Promise<ArrayBuffer>>();
  /** Звуки, запрошенные до окончания загрузки: прозвучат, если успеют за PENDING_MS. */
  private readonly pending = new Map<SoundName, number>();
  private settingsValue: SoundSettings;
  private paused = false;

  constructor(private readonly deps: SoundDeps) {
    let raw: string | null = null;
    try {
      raw = deps.storage?.getItem(SOUND_SETTINGS_KEY) ?? null;
    } catch {
      // Хранилище недоступно — звук со значениями по умолчанию
    }
    this.settingsValue = parseSoundSettings(raw);
  }

  get settings(): SoundSettings {
    return { ...this.settingsValue };
  }

  /** Звуки, которые не удалось загрузить (для проверки и отладки). */
  get unavailable(): SoundName[] {
    return [...this.failed];
  }

  get unlocked(): boolean {
    return this.context !== null;
  }

  onChange(listener: (settings: SoundSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Начинает скачивать звуки заранее (без аудиоконтекста, его создаёт только жест игрока). */
  prefetch(): void {
    for (const [name, url] of Object.entries(this.deps.urls) as [SoundName, string][]) {
      if (this.downloads.has(name)) continue;
      const download = this.deps.load(url);
      // Ошибка обработается при декодировании; здесь только не даём ей стать необработанной
      download.catch(() => undefined);
      this.downloads.set(name, download);
    }
  }

  /**
   * Вызывается из обработчика жеста игрока. Создаёт контекст и начинает загрузку звуков.
   * Возвращает обещание окончания загрузки (ошибки отдельных звуков не отклоняют его).
   */
  unlock(): Promise<void> {
    if (!this.context) {
      let context: AudioContextLike | null;
      try {
        context = this.deps.createContext();
      } catch {
        context = null;
      }
      if (!context) return Promise.resolve();
      this.context = context;
      this.master = context.createGain();
      this.master.connect(context.destination);
      this.applyVolume();
      return this.loadAll();
    }
    if (!this.paused) void this.context.resume().catch(() => undefined);
    return Promise.resolve();
  }

  play(name: SoundName, options: { rate?: number } = {}): boolean {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || !this.master || this.paused || this.settingsValue.muted || this.settingsValue.volume === 0) {
      return false;
    }
    if (!buffer) {
      if (!this.failed.has(name)) this.pending.set(name, Date.now());
      return false;
    }
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      // Небольшой разброс высоты: повторяющийся звук не утомляет
      source.playbackRate.value = (options.rate ?? 1) * (0.97 + Math.random() * 0.06);
      const level = context.createGain();
      level.gain.value = LEVEL[name];
      source.connect(level);
      level.connect(this.master);
      source.start();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted: boolean): void {
    this.update({ ...this.settingsValue, muted });
  }

  setVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0));
    this.update({ ...this.settingsValue, volume: clamped });
  }

  /** Пауза площадки или скрытая вкладка. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.context) return;
    const action = paused ? this.context.suspend() : this.context.resume();
    void action.catch(() => undefined);
  }

  private update(next: SoundSettings): void {
    this.settingsValue = next;
    this.applyVolume();
    try {
      this.deps.storage?.setItem(SOUND_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Не сохранилось — настройка действует до перезагрузки
    }
    for (const listener of this.listeners) listener(this.settings);
  }

  private applyVolume(): void {
    if (!this.master) return;
    // Восприятие громкости нелинейно: квадрат даёт ровную шкалу на ползунке
    this.master.gain.value = this.settingsValue.muted ? 0 : this.settingsValue.volume ** 2;
  }

  private async loadAll(): Promise<void> {
    const context = this.context;
    if (!context) return;
    this.prefetch();
    await Promise.all(
      [...this.downloads].map(async ([name, download]) => {
        try {
          this.buffers.set(name, await context.decodeAudioData(await download));
        } catch {
          this.failed.add(name);
          this.pending.delete(name);
          return;
        }
        const requested = this.pending.get(name);
        this.pending.delete(name);
        if (requested !== undefined && Date.now() - requested <= PENDING_MS) this.play(name);
      }),
    );
  }
}

/** Система для браузера: файлы из assets/audio, настоящий AudioContext, localStorage. */
export function createBrowserSoundSystem(urls: Partial<Record<SoundName, string>>): SoundSystem {
  let storage: StorageLike | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return new SoundSystem({
    urls,
    storage,
    createContext: () => {
      const Constructor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return Constructor ? new Constructor() : null;
    },
    load: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    },
  });
}
