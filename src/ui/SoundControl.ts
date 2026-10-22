import type { SoundSystem } from '../audio';
import type { Translator } from '../i18n';
import { el } from './dom';

/** Динамик пером: волны звука или перечёркнутый. */
const SPEAKER =
  '<path d="M3 9.5 H7 L12 5 V19 L7 14.5 H3 Z" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
const WAVES =
  '<path d="M15.5 9 Q17.5 12 15.5 15 M18 6.5 Q22 12 18 17.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
const CROSS = '<path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

/**
 * Управление звуком на столе: кнопка включает и выключает звук,
 * на широких экранах рядом — ползунок громкости.
 */
export class SoundControl {
  readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly volume: HTMLInputElement;

  constructor(
    private readonly sound: SoundSystem,
    i18n: Translator,
  ) {
    this.button = el('button', {
      className: 'desk-bar__button sound-control__toggle',
      attrs: { type: 'button', 'aria-label': i18n.t('sound.label'), 'data-testid': 'sound-toggle' },
    });
    this.button.addEventListener('click', () => this.sound.setMuted(!this.sound.settings.muted));
    this.volume = el('input', {
      className: 'sound-control__volume',
      attrs: { type: 'range', min: '0', max: '100', step: '5', 'aria-label': i18n.t('sound.volume'), 'data-testid': 'sound-volume' },
    });
    this.volume.addEventListener('input', () => {
      this.sound.setVolume(Number(this.volume.value) / 100);
      if (this.sound.settings.muted && Number(this.volume.value) > 0) this.sound.setMuted(false);
    });
    this.root = el('div', { className: 'sound-control' }, [this.button, this.volume]);
    this.sound.onChange(() => this.render());
    this.render();
  }

  private render(): void {
    const { muted, volume } = this.sound.settings;
    const on = !muted && volume > 0;
    this.button.setAttribute('aria-pressed', String(on));
    this.button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SPEAKER}${on ? WAVES : CROSS}</svg>`;
    this.volume.value = String(Math.round(volume * 100));
  }
}
