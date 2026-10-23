import { describe, expect, it, vi } from 'vitest';
import { createPlatform } from '../../src/platform';
import { resolveLocale } from '../../src/i18n';
import { PauseState, type FocusSource, type VisibilitySource } from '../../src/platform/Platform';
import { YandexPlatform, type YandexSdk } from '../../src/platform/yandex/YandexPlatform';

class FakeVisibility extends EventTarget implements VisibilitySource {
  hidden = false;
  setHidden(value: boolean): void {
    this.hidden = value;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

class FakeFocus extends EventTarget implements FocusSource {
  focused = true;
  hasFocus(): boolean {
    return this.focused;
  }
  blur(): void {
    this.focused = false;
    this.dispatchEvent(new Event('blur'));
  }
  focus(): void {
    this.focused = true;
    this.dispatchEvent(new Event('focus'));
  }
}

function fakeSdk(lang: unknown = 'ru') {
  const handlers = new Map<string, () => void>();
  const ready = vi.fn();
  const sdk = {
    on: (event: string, handler: () => void) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
    features: { LoadingAPI: { ready } },
    environment: { i18n: { lang, tld: 'ru' } },
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

describe('потеря фокуса', () => {
  it('пауза при уходе фокуса и снятие при возвращении, повторные события ничего не переключают', () => {
    const pause = new PauseState();
    const focus = new FakeFocus();
    const states: boolean[] = [];
    pause.subscribe((paused) => states.push(paused));
    pause.trackFocus(focus);
    focus.blur();
    focus.dispatchEvent(new Event('blur'));
    focus.focus();
    focus.dispatchEvent(new Event('focus'));
    expect(states).toEqual([true, false]);
  });

  it('событие focus без настоящего фокуса не снимает паузу', () => {
    const pause = new PauseState();
    const focus = new FakeFocus();
    pause.trackFocus(focus);
    focus.blur();
    focus.dispatchEvent(new Event('focus'));
    expect(pause.paused).toBe(true);
  });

  it('игра, запущенная без фокуса, начинает на паузе', () => {
    const pause = new PauseState();
    const focus = new FakeFocus();
    focus.focused = false;
    pause.trackFocus(focus);
    expect(pause.paused).toBe(true);
  });

  it('фокус, вкладка и площадка складываются: звук вернётся, только когда сняты все причины', () => {
    const pause = new PauseState();
    const focus = new FakeFocus();
    const visibility = new FakeVisibility();
    const states: boolean[] = [];
    pause.subscribe((paused) => states.push(paused));
    pause.trackFocus(focus);
    pause.trackVisibility(visibility);
    focus.blur();
    visibility.setHidden(true);
    pause.set('platform', true);
    focus.focus();
    visibility.setHidden(false);
    expect(pause.paused).toBe(true);
    pause.set('platform', false);
    expect(states).toEqual([true, false]);
  });
});

describe('язык площадки', () => {
  it('берётся из ysdk.environment.i18n.lang', () => {
    expect(new YandexPlatform(fakeSdk('ru').sdk).language).toBe('ru');
    expect(new YandexPlatform(fakeSdk('tr').sdk).language).toBe('tr');
  });

  it('неожиданный ответ SDK не ломает запуск', () => {
    expect(new YandexPlatform(fakeSdk(null).sdk).language).toBeNull();
    expect(new YandexPlatform(fakeSdk('').sdk).language).toBeNull();
    expect(new YandexPlatform(fakeSdk(42).sdk).language).toBeNull();
    const broken = fakeSdk().sdk;
    Object.defineProperty(broken, 'environment', {
      get: () => {
        throw new Error('нет окружения');
      },
    });
    expect(new YandexPlatform(broken).language).toBeNull();
  });

  it('неподдерживаемый язык площадки показывает русский интерфейс', () => {
    expect(resolveLocale('ru')).toBe('ru');
    expect(resolveLocale('en')).toBe('ru');
    expect(resolveLocale(null)).toBe('ru');
  });

  it('вне площадки язык не сообщается', async () => {
    const platform = await createPlatform({ target: 'local' });
    expect(platform.language).toBeNull();
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

  it('не ждёт зависший SDK бесконечно', async () => {
    const warn = vi.fn();
    const platform = await createPlatform({
      target: 'yandex',
      globalScope: { YaGames: { init: () => new Promise(() => undefined) } },
      warn,
      initTimeoutMs: 20,
    });
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
    expect(platform.paused).toBe(true);
    emit('game_api_resume');
    expect(states).toEqual([true, false]);
  });
});
