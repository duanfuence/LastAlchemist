import { el } from './dom';

export const ATMOSPHERE_KEY = 'last-alchemist:atmosphere';

export interface AtmosphereStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Сохранённая настройка: повреждённое значение и недоступное хранилище означают «включено». */
export function parseAtmosphere(raw: string | null): boolean {
  if (raw === null) return true;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'object' && value !== null && 'enabled' in value) return value.enabled !== false;
  } catch {
    // Повреждённая запись — значение по умолчанию
  }
  return true;
}

/** Сколько пылинок плавает в луче свечи: мало — эффект должен быть едва заметен. */
export const MOTE_COUNT = 8;
/** Пылинки, взметнувшиеся при открытии книги. */
export const PUFF_COUNT = 16;
/** Длительность всплеска при раскрытии книги (с запасом на задержки пылинок). */
const STIR_MS = 2000;

/**
 * Атмосфера лаборатории: дыхание света свечи над книгой, редкие пылинки в косом луче,
 * всплеск света и облачко пыли, когда книгу раскрывают.
 * Всё — CSS-анимации прозрачности и сдвига (без перерисовки страницы); слой не перехватывает нажатия.
 * Игрок может отключить эффекты; при «уменьшении движения» в системе они не анимируются.
 */
export class Atmosphere {
  readonly layer: HTMLElement;
  private value: boolean;
  private stirTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners: (() => void)[] = [];

  constructor(
    private readonly storage: AtmosphereStorage | null,
    private readonly root: HTMLElement = document.documentElement,
    random: () => number = Math.random,
  ) {
    let raw: string | null;
    try {
      raw = storage?.getItem(ATMOSPHERE_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.value = parseAtmosphere(raw);

    const motes = Array.from({ length: MOTE_COUNT }, (_, i) => {
      const mote = el('span', { className: 'mote' });
      // Пылинки рассеяны вдоль луча; у каждой свой темп, чтобы движение не выглядело синхронным
      const along = (i + random() * 0.8) / MOTE_COUNT;
      mote.style.setProperty('--x', `${(8 + along * 70 + random() * 8).toFixed(1)}%`);
      mote.style.setProperty('--y', `${(10 + along * 62 + random() * 10).toFixed(1)}%`);
      mote.style.setProperty('--size', `${(1.8 + random() * 2).toFixed(1)}px`);
      mote.style.setProperty('--duration', `${(16 + random() * 14).toFixed(1)}s`);
      mote.style.setProperty('--delay', `${(-random() * 30).toFixed(1)}s`);
      // Общий путь из ключевых кадров поворачивается и растягивается: каждая плывёт по-своему
      mote.style.setProperty('--angle', `${(-25 + random() * 40).toFixed(0)}deg`);
      mote.style.setProperty('--reach', (0.7 + random() * 0.8).toFixed(2));
      return mote;
    });
    // Пыль вылетает из корешка, когда страницы расходятся: в обе стороны и вверх
    const puff = Array.from({ length: PUFF_COUNT }, (_, i) => {
      const mote = el('span', { className: 'mote mote--puff' });
      const side = i % 2 === 0 ? -1 : 1;
      mote.style.setProperty('--x', `${(50 + side * random() * 3).toFixed(1)}%`);
      mote.style.setProperty('--y', `${(28 + (i / PUFF_COUNT) * 52 + random() * 4).toFixed(1)}%`);
      mote.style.setProperty('--size', `${(2.2 + random() * 2.6).toFixed(1)}px`);
      mote.style.setProperty('--delay', `${(random() * 0.3).toFixed(2)}s`);
      // Ключевые кадры сдвигают пылинку на 100 px вправо; угол и длина пути — свои у каждой
      const angle = side > 0 ? -10 - random() * 50 : -170 + random() * 50;
      mote.style.setProperty('--angle', `${angle.toFixed(0)}deg`);
      mote.style.setProperty('--reach', (0.5 + random() * 1.1).toFixed(2));
      return mote;
    });
    this.layer = el('div', { className: 'atmosphere', attrs: { 'aria-hidden': 'true', 'data-testid': 'atmosphere' } }, [
      el('div', { className: 'atmosphere__beam' }),
      el('div', { className: 'atmosphere__light' }),
      el('div', { className: 'atmosphere__motes' }, motes),
      el('div', { className: 'atmosphere__puff' }, puff),
    ]);
    this.apply();
  }

  get enabled(): boolean {
    return this.value;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.value) return;
    this.value = enabled;
    try {
      this.storage?.setItem(ATMOSPHERE_KEY, JSON.stringify({ enabled }));
    } catch {
      // Хранилище недоступно: настройка действует до перезагрузки
    }
    this.apply();
    for (const listener of this.listeners) listener();
  }

  /** Книгу раскрыли: свет вспыхивает, из страниц поднимается облачко пыли. */
  stir(): void {
    if (!this.value) return;
    this.layer.classList.remove('is-stirred');
    // Перезапуск анимации: класс снимается и ставится заново после перерасчёта стилей
    void this.layer.offsetWidth;
    this.layer.classList.add('is-stirred');
    clearTimeout(this.stirTimer);
    this.stirTimer = setTimeout(() => this.layer.classList.remove('is-stirred'), STIR_MS);
  }

  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  private apply(): void {
    this.root.dataset['atmosphere'] = this.value ? 'on' : 'off';
  }
}
