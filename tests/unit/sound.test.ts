import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND_SETTINGS,
  SOUND_SETTINGS_KEY,
  SoundSystem,
  parseSoundSettings,
  type AudioContextLike,
  type SoundDeps,
} from '../../src/audio/SoundSystem';

class FakeContext implements AudioContextLike {
  state = 'running';
  currentTime = 0;
  destination = {};
  started: unknown[] = [];
  suspendCalls = 0;
  resumeCalls = 0;
  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspendCalls += 1;
    this.state = 'suspended';
    return Promise.resolve();
  }
  decodeAudioData(data: ArrayBuffer): Promise<unknown> {
    if (data.byteLength === 0) return Promise.reject(new Error('повреждённый файл'));
    return Promise.resolve({ decoded: data.byteLength });
  }
  createGain() {
    return { gain: { value: 1 }, connect: () => undefined };
  }
  /** Все запущенные источники: эффекты и музыка. */
  sources: FakeSource[] = [];
  createBufferSource() {
    const source: FakeSource = {
      buffer: null,
      playbackRate: { value: 1 },
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      offset: undefined,
      stopped: false,
      connect: () => undefined,
      start: (_when?: number, offset?: number) => {
        source.offset = offset;
        this.started.push(source.buffer);
        this.sources.push(source);
      },
      stop: () => {
        source.stopped = true;
      },
    };
    return source;
  }
  get music(): FakeSource[] {
    return this.sources.filter((source) => source.loop);
  }
}

interface FakeSource {
  buffer: unknown;
  playbackRate: { value: number };
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  offset: number | undefined;
  stopped: boolean;
  connect(target: unknown): unknown;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function setup(overrides: Partial<SoundDeps> = {}) {
  const context = new FakeContext();
  const storage = new MemoryStorage();
  let contexts = 0;
  const deps: SoundDeps = {
    urls: { place: 'place.mp3', discover: 'discover.mp3' },
    createContext: () => {
      contexts += 1;
      return context;
    },
    load: () => Promise.resolve(new ArrayBuffer(8)),
    storage,
    ...overrides,
  };
  return { sound: new SoundSystem(deps), context, storage, contexts: () => contexts };
}

describe('настройки звука', () => {
  it('по умолчанию звук включён, громкость средняя', () => {
    expect(parseSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('повреждённые и выходящие за пределы значения исправляются', () => {
    expect(parseSoundSettings('{не json')).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(parseSoundSettings('{"muted":true,"volume":7,"musicVolume":-2}')).toMatchObject({ muted: true, volume: 1, musicVolume: 0 });
    expect(parseSoundSettings('{"muted":"да","volume":-1}')).toMatchObject({ muted: false, volume: 0 });
  });

  it('прежний формат { muted, volume } читается: громкость становится громкостью эффектов', () => {
    expect(parseSoundSettings('{"muted":false,"volume":0.35}')).toEqual({
      ...DEFAULT_SOUND_SETTINGS,
      volume: 0.35,
    });
  });
});

describe('SoundSystem', () => {
  it('до первого жеста игрока не создаёт аудиоконтекст и молчит', () => {
    const { sound, contexts } = setup();
    sound.prefetch();
    expect(sound.play('place')).toBe(false);
    expect(contexts()).toBe(0);
    expect(sound.unlocked).toBe(false);
  });

  it('после жеста загружает звуки и воспроизводит их', async () => {
    const { sound, context } = setup();
    await sound.unlock();
    expect(sound.unlocked).toBe(true);
    expect(sound.play('place')).toBe(true);
    expect(context.started).toHaveLength(1);
  });

  it('выключенный звук и нулевая громкость не воспроизводятся', async () => {
    const { sound, context } = setup();
    await sound.unlock();
    sound.setMuted(true);
    expect(sound.play('place')).toBe(false);
    sound.setMuted(false);
    sound.setVolume(0);
    expect(sound.play('place')).toBe(false);
    expect(context.started).toHaveLength(0);
  });

  it('недоступный или повреждённый файл не ломает игру', async () => {
    const { sound } = setup({
      load: (url) => (url === 'place.mp3' ? Promise.reject(new Error('404')) : Promise.resolve(new ArrayBuffer(0))),
    });
    await expect(sound.unlock()).resolves.toBeUndefined();
    expect(sound.unavailable.sort()).toEqual(['discover', 'place']);
    expect(sound.play('place')).toBe(false);
    expect(sound.play('discover')).toBe(false);
  });

  it('без Web Audio игра работает молча', async () => {
    const { sound } = setup({ createContext: () => null });
    await sound.unlock();
    expect(sound.unlocked).toBe(false);
    expect(sound.play('place')).toBe(false);
  });

  it('пауза площадки приостанавливает звук, продолжение — возобновляет', async () => {
    const { sound, context } = setup();
    await sound.unlock();
    sound.setPaused(true);
    expect(context.suspendCalls).toBe(1);
    expect(sound.play('place')).toBe(false);
    sound.setPaused(false);
    expect(context.resumeCalls).toBeGreaterThan(0);
    expect(sound.play('place')).toBe(true);
  });

  it('настройки сохраняются и восстанавливаются', () => {
    const { sound, storage } = setup();
    sound.setVolume(0.35);
    sound.setMuted(true);
    sound.setMusicVolume(0.2);
    sound.setEffectsMuted(true);
    const expected = { muted: true, volume: 0.35, effectsMuted: true, musicMuted: false, musicVolume: 0.2 };
    expect(JSON.parse(storage.getItem(SOUND_SETTINGS_KEY) ?? '')).toEqual(expected);
    const restored = new SoundSystem({ urls: {}, createContext: () => null, load: () => Promise.resolve(new ArrayBuffer(0)), storage });
    expect(restored.settings).toEqual(expected);
  });

  it('недоступное хранилище не мешает менять настройки', () => {
    const broken = {
      getItem: () => {
        throw new Error('нет доступа');
      },
      setItem: () => {
        throw new Error('нет доступа');
      },
    };
    const { sound } = setup({ storage: broken });
    expect(sound.settings).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(() => sound.setMuted(true)).not.toThrow();
    expect(sound.settings.muted).toBe(true);
  });

  it('звук, запрошенный во время загрузки, звучит, когда файл готов', async () => {
    let release: (data: ArrayBuffer) => void = () => undefined;
    const { sound, context } = setup({
      urls: { book: 'book.mp3' },
      load: () => new Promise<ArrayBuffer>((resolve) => (release = resolve)),
    });
    const loading = sound.unlock();
    expect(sound.play('book')).toBe(false);
    release(new ArrayBuffer(4));
    await loading;
    expect(context.started).toHaveLength(1);
  });
});

const MUSIC = { url: 'music.mp3', loopStart: 0.5, loopEnd: 128.5 };

describe('фоновая музыка', () => {
  it('до первого жеста не загружается и не звучит', () => {
    const loaded: string[] = [];
    const { sound } = setup({ music: MUSIC, load: (url) => (loaded.push(url), Promise.resolve(new ArrayBuffer(8))) });
    sound.prefetch();
    expect(loaded).not.toContain('music.mp3');
    expect(sound.musicPlaying).toBe(false);
  });

  it('после жеста играет одним бесконечным источником с бесшовным циклом', async () => {
    const { sound, context } = setup({ music: MUSIC });
    await sound.unlock();
    expect(sound.musicPlaying).toBe(true);
    expect(context.music).toHaveLength(1);
    expect(context.music[0]).toMatchObject({ loop: true, loopStart: 0.5, loopEnd: 128.5, offset: 0.5 });
    // Эффекты не перезапускают музыку
    sound.play('place');
    sound.play('discover');
    expect(context.music).toHaveLength(1);
    expect(context.music[0]!.stopped).toBe(false);
  });

  it('выключенная музыка не загружается вовсе', async () => {
    const loaded: string[] = [];
    const storage = new MemoryStorage();
    storage.setItem(SOUND_SETTINGS_KEY, JSON.stringify({ musicMuted: true }));
    const { sound } = setup({ music: MUSIC, storage, load: (url) => (loaded.push(url), Promise.resolve(new ArrayBuffer(8))) });
    await sound.unlock();
    expect(loaded).not.toContain('music.mp3');
    expect(sound.musicPlaying).toBe(false);
    // Эффекты при этом работают
    expect(sound.play('place')).toBe(true);
  });

  it('выключение и включение музыки продолжает с того же места, а не с начала', async () => {
    const { sound, context } = setup({ music: MUSIC });
    await sound.unlock();
    context.currentTime = 40;
    sound.setMusicMuted(true);
    expect(context.music[0]!.stopped).toBe(true);
    expect(sound.musicPlaying).toBe(false);
    context.currentTime = 60;
    sound.setMusicMuted(false);
    await Promise.resolve();
    expect(context.music).toHaveLength(2);
    expect(context.music[1]!.offset).toBeCloseTo(40.5);
  });

  it('позиция переходит через точку цикла', async () => {
    const { sound, context } = setup({ music: MUSIC });
    await sound.unlock();
    context.currentTime = 130;
    sound.setMuted(true);
    sound.setMuted(false);
    await Promise.resolve();
    // 0,5 + 130 = 130,5 → после конца цикла (128,5) это 2,5
    expect(context.music.at(-1)!.offset).toBeCloseTo(2.5);
  });

  it('музыку и эффекты можно выключать независимо', async () => {
    const { sound, context } = setup({ music: MUSIC });
    await sound.unlock();
    sound.setEffectsMuted(true);
    expect(sound.play('place')).toBe(false);
    expect(sound.musicPlaying).toBe(true);
    sound.setEffectsMuted(false);
    sound.setMusicMuted(true);
    expect(sound.play('place')).toBe(true);
    expect(sound.musicPlaying).toBe(false);
    sound.setMusicVolume(0);
    sound.setMusicMuted(false);
    await Promise.resolve();
    expect(sound.musicPlaying).toBe(false);
    expect(context.music).toHaveLength(1);
  });

  it('весь звук выключается одним переключателем', async () => {
    const { sound } = setup({ music: MUSIC });
    await sound.unlock();
    sound.setMuted(true);
    expect(sound.play('place')).toBe(false);
    expect(sound.musicPlaying).toBe(false);
  });

  it('недоступный файл музыки не ломает эффекты', async () => {
    const { sound } = setup({
      music: MUSIC,
      load: (url) => (url === 'music.mp3' ? Promise.reject(new Error('404')) : Promise.resolve(new ArrayBuffer(8))),
    });
    await expect(sound.unlock()).resolves.toBeUndefined();
    expect(sound.musicUnavailable).toBe(true);
    expect(sound.musicPlaying).toBe(false);
    expect(sound.play('place')).toBe(true);
  });

  it('пауза площадки приостанавливает музыку, не останавливая её', async () => {
    const { sound, context } = setup({ music: MUSIC });
    await sound.unlock();
    sound.setPaused(true);
    expect(context.suspendCalls).toBe(1);
    expect(context.music[0]!.stopped).toBe(false);
    sound.setPaused(false);
    expect(sound.musicPlaying).toBe(true);
  });
});
