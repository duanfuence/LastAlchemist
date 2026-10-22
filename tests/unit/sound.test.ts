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
  createBufferSource() {
    const source = {
      buffer: null as unknown,
      playbackRate: { value: 1 },
      connect: () => undefined,
      start: () => this.started.push(source.buffer),
    };
    return source;
  }
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
    expect(parseSoundSettings('{"muted":true,"volume":7}')).toEqual({ muted: true, volume: 1 });
    expect(parseSoundSettings('{"muted":"да","volume":-1}')).toEqual({ muted: false, volume: 0 });
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
    expect(JSON.parse(storage.getItem(SOUND_SETTINGS_KEY) ?? '')).toEqual({ muted: true, volume: 0.35 });
    const restored = new SoundSystem({ urls: {}, createContext: () => null, load: () => Promise.resolve(new ArrayBuffer(0)), storage });
    expect(restored.settings).toEqual({ muted: true, volume: 0.35 });
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
