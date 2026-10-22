/**
 * Звуки и музыка книги на Web Audio — одна система, три шины:
 *   эффекты ─┐
 *   музыка  ─┴─ общая громкость ─ динамики
 *
 * - Аудиоконтекст создаётся только после первого жеста игрока (требование браузеров
 *   и правил площадки): до этого ничего не звучит и музыка не загружается.
 * - Эффекты скачиваются заранее; музыка — только когда она включена (экономия памяти).
 *   Недоступный или повреждённый файл просто молчит, игра не ждёт загрузки.
 * - Музыка — один бесконечный источник с бесшовным циклом (loopStart/loopEnd): действия игрока
 *   её не перезапускают. Выключенная музыка запоминает место и продолжает с него.
 * - Звук открытия ненадолго приглушает музыку, чтобы эффект не тонул в ней.
 * - Пауза площадки и скрытая вкладка приостанавливают контекст целиком.
 * - Настройки хранятся отдельно от прогресса.
 */

export type SoundName = 'place' | 'react' | 'fail' | 'discover' | 'secret' | 'book';

export interface SoundSettings {
  /** Весь звук выключен. */
  muted: boolean;
  /** Громкость эффектов, 0…1. */
  volume: number;
  effectsMuted: boolean;
  musicMuted: boolean;
  /** Громкость музыки, 0…1. */
  musicVolume: number;
}

/** Файл музыки и точки бесшовного цикла (секунды от начала файла). */
export interface MusicTrack {
  url: string;
  loopStart: number;
  loopEnd: number;
}

/** Сколько ждать загрузки звука, запрошенного раньше, чем он был готов (мс). */
const PENDING_MS = 500;
/** Плавное появление музыки (постоянная времени, с). */
const MUSIC_FADE_IN = 1.4;
/** Плавное затухание музыки при выключении (постоянная времени, с) и момент остановки источника. */
const MUSIC_FADE_OUT = 0.15;
const MUSIC_STOP_AFTER = 0.8;
/** Музыка тише эффектов при одинаковом положении ползунков: она фон. */
const MUSIC_LEVEL = 0.6;

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  muted: false,
  volume: 0.7,
  effectsMuted: false,
  musicMuted: false,
  musicVolume: 0.45,
};
export const SOUND_SETTINGS_KEY = 'last-alchemist:sound';

/** Параметр Web Audio: плавные изменения необязательны (в тестах их может не быть). */
export interface ParamLike {
  value: number;
  setTargetAtTime?(target: number, startTime: number, timeConstant: number): unknown;
  cancelScheduledValues?(startTime: number): unknown;
}

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
  gain: ParamLike;
  connect(target: unknown): unknown;
}

export interface SourceLike {
  buffer: unknown;
  playbackRate: { value: number };
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  connect(target: unknown): unknown;
  start(when?: number, offset?: number): void;
  stop?(when?: number): void;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SoundDeps {
  urls: Partial<Record<SoundName, string>>;
  music?: MusicTrack;
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

/** Эти звуки на мгновение приглушают музыку. */
const DUCKING: Partial<Record<SoundName, number>> = { discover: 0.55, secret: 0.45, book: 0.7 };

const clamp01 = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

/** Разбор настроек. Старый формат ({ muted, volume }) читается: volume становится громкостью эффектов. */
export function parseSoundSettings(raw: string | null): SoundSettings {
  if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_SOUND_SETTINGS };
    const record = data as Record<string, unknown>;
    return {
      muted: record['muted'] === true,
      volume: clamp01(record['volume'], DEFAULT_SOUND_SETTINGS.volume),
      effectsMuted: record['effectsMuted'] === true,
      musicMuted: record['musicMuted'] === true,
      musicVolume: clamp01(record['musicVolume'], DEFAULT_SOUND_SETTINGS.musicVolume),
    };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

/** Плавно ведёт параметр к значению; без поддержки плавности — сразу. */
function glide(param: ParamLike, value: number, at: number, timeConstant: number): void {
  if (param.setTargetAtTime) {
    param.cancelScheduledValues?.(at);
    param.setTargetAtTime(value, at, timeConstant);
  } else {
    param.value = value;
  }
}

export class SoundSystem {
  private context: AudioContextLike | null = null;
  private master: GainLike | null = null;
  private effectsBus: GainLike | null = null;
  private musicBus: GainLike | null = null;
  /** Приглушение музыки под звуки открытия. */
  private musicDuck: GainLike | null = null;
  private readonly buffers = new Map<SoundName, unknown>();
  private readonly failed = new Set<SoundName>();
  private readonly listeners = new Set<(settings: SoundSettings) => void>();
  /** Загрузка файлов идёт заранее, без аудиоконтекста; декодирование — после первого жеста. */
  private readonly downloads = new Map<SoundName, Promise<ArrayBuffer>>();
  /** Звуки, запрошенные до окончания загрузки: прозвучат, если успеют за PENDING_MS. */
  private readonly pending = new Map<SoundName, number>();
  private settingsValue: SoundSettings;
  private paused = false;

  private musicBuffer: unknown = null;
  private musicLoading: Promise<void> | null = null;
  private musicFailed = false;
  private musicSource: SourceLike | null = null;
  private musicFader: GainLike | null = null;
  /** Время контекста, когда источник начал играть с позиции musicOffset. */
  private musicStartedAt = 0;
  /** Позиция в файле, с которой музыка продолжит (с). */
  private musicOffset = 0;

  constructor(private readonly deps: SoundDeps) {
    let raw: string | null = null;
    try {
      raw = deps.storage?.getItem(SOUND_SETTINGS_KEY) ?? null;
    } catch {
      // Хранилище недоступно — звук со значениями по умолчанию
    }
    this.settingsValue = parseSoundSettings(raw);
    this.musicOffset = deps.music?.loopStart ?? 0;
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

  /** Музыка сейчас играет (источник запущен и не выключен). */
  get musicPlaying(): boolean {
    return this.musicSource !== null;
  }

  get musicUnavailable(): boolean {
    return this.musicFailed;
  }

  onChange(listener: (settings: SoundSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Начинает скачивать эффекты заранее (без аудиоконтекста, его создаёт только жест игрока). */
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
   * Вызывается из обработчика жеста игрока. Создаёт контекст, загружает эффекты и, если музыка
   * включена, запускает её. Возвращает обещание окончания загрузки (ошибки не отклоняют его).
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
      this.effectsBus = context.createGain();
      this.effectsBus.connect(this.master);
      this.musicBus = context.createGain();
      this.musicBus.connect(this.master);
      this.musicDuck = context.createGain();
      this.musicDuck.connect(this.musicBus);
      this.applyVolume();
      return this.loadAll().then(() => this.syncMusic());
    }
    if (!this.paused) void this.context.resume().catch(() => undefined);
    return Promise.resolve();
  }

  play(name: SoundName, options: { rate?: number } = {}): boolean {
    const context = this.context;
    const buffer = this.buffers.get(name);
    const { muted, effectsMuted, volume } = this.settingsValue;
    if (!context || !this.effectsBus || this.paused || muted || effectsMuted || volume === 0) return false;
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
      level.connect(this.effectsBus);
      source.start();
      this.duck(DUCKING[name]);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(muted: boolean): void {
    this.update({ ...this.settingsValue, muted });
  }

  setVolume(volume: number): void {
    this.update({ ...this.settingsValue, volume: clamp01(volume, 0) });
  }

  setEffectsMuted(effectsMuted: boolean): void {
    this.update({ ...this.settingsValue, effectsMuted });
  }

  setMusicMuted(musicMuted: boolean): void {
    this.update({ ...this.settingsValue, musicMuted });
  }

  setMusicVolume(musicVolume: number): void {
    this.update({ ...this.settingsValue, musicVolume: clamp01(musicVolume, 0) });
  }

  /** Пауза площадки или скрытая вкладка: замирает всё, музыка потом продолжается с того же места. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.context) return;
    const action = paused ? this.context.suspend() : this.context.resume();
    void action.catch(() => undefined);
  }

  private get musicWanted(): boolean {
    const { muted, musicMuted, musicVolume } = this.settingsValue;
    return Boolean(this.deps.music) && !muted && !musicMuted && musicVolume > 0;
  }

  private update(next: SoundSettings): void {
    this.settingsValue = next;
    this.applyVolume();
    try {
      this.deps.storage?.setItem(SOUND_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Не сохранилось — настройка действует до перезагрузки
    }
    void this.syncMusic();
    for (const listener of this.listeners) listener(this.settings);
  }

  private applyVolume(): void {
    const context = this.context;
    if (!context || !this.master || !this.effectsBus || !this.musicBus) return;
    const { muted, volume, effectsMuted, musicMuted, musicVolume } = this.settingsValue;
    const now = context.currentTime;
    // Восприятие громкости нелинейно: квадрат даёт ровную шкалу на ползунке
    glide(this.master.gain, muted ? 0 : 1, now, 0.05);
    glide(this.effectsBus.gain, effectsMuted ? 0 : volume ** 2, now, 0.05);
    glide(this.musicBus.gain, musicMuted ? 0 : musicVolume ** 2 * MUSIC_LEVEL, now, 0.08);
  }

  /** Запускает или останавливает музыку в соответствии с настройками. */
  private async syncMusic(): Promise<void> {
    if (!this.context) return;
    if (!this.musicWanted) {
      this.stopMusic();
      return;
    }
    if (this.musicSource) return;
    await this.loadMusic();
    // Пока файл грузился, настройки могли измениться
    if (this.musicWanted && !this.musicSource) this.startMusic();
  }

  private loadMusic(): Promise<void> {
    const context = this.context;
    const track = this.deps.music;
    if (!context || !track || this.musicBuffer || this.musicFailed) return Promise.resolve();
    this.musicLoading ??= this.deps
      .load(track.url)
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        this.musicBuffer = buffer;
      })
      .catch(() => {
        this.musicFailed = true;
      });
    return this.musicLoading;
  }

  private startMusic(): void {
    const context = this.context;
    const track = this.deps.music;
    if (!context || !track || !this.musicBuffer || !this.musicDuck) return;
    try {
      const source = context.createBufferSource();
      source.buffer = this.musicBuffer;
      source.loop = true;
      source.loopStart = track.loopStart;
      source.loopEnd = track.loopEnd;
      const fader = context.createGain();
      fader.gain.value = 0;
      source.connect(fader);
      fader.connect(this.musicDuck);
      source.start(0, this.musicOffset);
      glide(fader.gain, 1, context.currentTime, MUSIC_FADE_IN);
      this.musicSource = source;
      this.musicFader = fader;
      this.musicStartedAt = context.currentTime;
    } catch {
      this.musicFailed = true;
    }
  }

  private stopMusic(): void {
    const context = this.context;
    const track = this.deps.music;
    const source = this.musicSource;
    if (!context || !track || !source) return;
    // Запоминаем место: при включении музыка продолжится отсюда, а не с начала
    const length = track.loopEnd - track.loopStart;
    const played = context.currentTime - this.musicStartedAt;
    const position = this.musicOffset + played;
    this.musicOffset = position < track.loopEnd ? position : track.loopStart + ((position - track.loopStart) % length);
    if (this.musicFader) glide(this.musicFader.gain, 0, context.currentTime, MUSIC_FADE_OUT);
    try {
      source.stop?.(context.currentTime + MUSIC_STOP_AFTER);
    } catch {
      // Источник уже остановлен
    }
    this.musicSource = null;
    this.musicFader = null;
  }

  private duck(depth: number | undefined): void {
    const context = this.context;
    if (!depth || !context || !this.musicDuck || !this.musicSource) return;
    const now = context.currentTime;
    glide(this.musicDuck.gain, depth, now, 0.06);
    // Возврат после звука: setTargetAtTime продолжит с заданного момента
    this.musicDuck.gain.setTargetAtTime?.(1, now + 0.5, 0.9);
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
export function createBrowserSoundSystem(urls: Partial<Record<SoundName, string>>, music?: MusicTrack): SoundSystem {
  let storage: StorageLike | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return new SoundSystem({
    urls,
    ...(music ? { music } : {}),
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
