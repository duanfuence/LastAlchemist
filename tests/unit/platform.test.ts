import { describe, expect, it, vi } from 'vitest';
import { createPlatform } from '../../src/platform';
import { PauseState, type VisibilitySource } from '../../src/platform/Platform';
import { YandexPlatform, type YandexSdk } from '../../src/platform/yandex/YandexPlatform';

class FakeVisibility extends EventTarget implements VisibilitySource {
  hidden = false;
  setHidden(value: boolean): void {
    this.hidden = value;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function fakeSdk() {
  const handlers = new Map<string, () => void>();
  const ready = vi.fn();
  const sdk = {
    on: (event: string, handler: () => void) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
    features: { LoadingAPI: { ready } },
  } as unknown as YandexSdk;
  return { sdk, ready, emit: (event: string) => handlers.get(event)?.() };
}

describe('PauseState', () => {
  it('сообщает только об изменении итогового состояния', () => {
    const pause = new PauseState();
    const listener = vi.fn();
    pause.subscribe(listener);
    pause.set('hidden', true);
    pause.set('platform', true);
    pause.set('hidden', false);
    expect(listener).toHaveBeenCalledTimes(1);
    pause.set('platform', false);
    expect(listener).toHaveBeenLastCalledWith(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('следит за видимостью вкладки', () => {
    const pause = new PauseState();
    const visibility = new FakeVisibility();
    pause.trackVisibility(visibility);
    visibility.setHidden(true);
    expect(pause.paused).toBe(true);
    visibility.setHidden(false);
    expect(pause.paused).toBe(false);
  });
});

describe('createPlatform', () => {
  it('в режиме разработки не обращается к SDK', async () => {
    const init = vi.fn();
    const platform = await createPlatform({ target: 'local', globalScope: { YaGames: { init } } });
    expect(platform.kind).toBe('local');
    expect(init).not.toHaveBeenCalled();
  });

  it('использует SDK Яндекс Игр, если он загружен', async () => {
    const { sdk } = fakeSdk();
    const platform = await createPlatform({
      target: 'yandex',
      globalScope: { YaGames: { init: () => Promise.resolve(sdk) } },
    });
    expect(platform.kind).toBe('yandex');
  });

  it('продолжает работу без SDK, если он не загрузился', async () => {
    const warn = vi.fn();
    const platform = await createPlatform({ target: 'yandex', globalScope: {}, warn });
    expect(platform.kind).toBe('local');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('продолжает работу, если инициализация SDK завершилась ошибкой', async () => {
    const warn = vi.fn();
    const platform = await createPlatform({
      target: 'yandex',
      globalScope: { YaGames: { init: () => Promise.reject(new Error('network')) } },
      warn,
    });
    expect(platform.kind).toBe('local');
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('YandexPlatform', () => {
  it('вызывает LoadingAPI.ready() ровно один раз', () => {
    const { sdk, ready } = fakeSdk();
    const platform = new YandexPlatform(sdk);
    platform.gameReady();
    platform.gameReady();
    expect(ready).toHaveBeenCalledOnce();
  });

  it('переводит игру в паузу по событиям площадки', () => {
    const { sdk, emit } = fakeSdk();
    const platform = new YandexPlatform(sdk);
    const states: boolean[] = [];
    platform.onPauseChange((paused) => states.push(paused));
    emit('game_api_pause');
    emit('game_api_resume');
    expect(states).toEqual([true, false]);
  });
});
