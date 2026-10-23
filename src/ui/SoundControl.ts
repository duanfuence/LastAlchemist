import type { SoundSystem } from '../audio';
import type { Translator } from '../i18n';
import type { Atmosphere } from './Atmosphere';
import { el } from './dom';

/** Динамик пером: волны звука или перечёркнутый. */
const SPEAKER =
  '<path d="M3 9.5 H7 L12 5 V19 L7 14.5 H3 Z" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
const WAVES =
  '<path d="M15.5 9 Q17.5 12 15.5 15 M18 6.5 Q22 12 18 17.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
const CROSS = '<path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

let panelCounter = 0;

/**
 * Управление звуком на столе: кнопка-динамик открывает небольшую панель —
 * весь звук, музыка и эффекты, у музыки и эффектов своя громкость.
 */
export class SoundControl {
  readonly root: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly all: HTMLInputElement;
  private readonly music: HTMLInputElement;
  private readonly musicVolume: HTMLInputElement;
  private readonly effects: HTMLInputElement;
  private readonly effectsVolume: HTMLInputElement;
  private readonly atmosphereInput: HTMLInputElement | null;
  private open = false;

  constructor(
    private readonly sound: SoundSystem,
    i18n: Translator,
    private readonly atmosphere?: Atmosphere,
  ) {
    panelCounter += 1;
    const panelId = `sound-panel-${panelCounter}`;
    this.button = el('button', {
      className: 'desk-bar__button sound-control__toggle',
      attrs: {
        type: 'button',
        'aria-label': i18n.t('sound.settings'),
        'aria-expanded': 'false',
        'aria-controls': panelId,
        'data-testid': 'sound-toggle',
      },
    });
    this.button.addEventListener('click', () => this.setOpen(!this.open));

    const checkbox = (testId: string): HTMLInputElement =>
      el('input', { className: 'sound-panel__check', attrs: { type: 'checkbox', 'data-testid': testId } });
    const range = (testId: string, label: string): HTMLInputElement =>
      el('input', {
        className: 'sound-panel__range',
        attrs: { type: 'range', min: '0', max: '100', step: '5', 'aria-label': label, 'data-testid': testId },
      });
    this.all = checkbox('sound-all');
    this.music = checkbox('music-enabled');
    this.effects = checkbox('effects-enabled');
    this.musicVolume = range('music-volume', i18n.t('sound.musicVolume'));
    this.effectsVolume = range('effects-volume', i18n.t('sound.effectsVolume'));

    this.all.addEventListener('change', () => this.sound.setMuted(!this.all.checked));
    this.music.addEventListener('change', () => this.sound.setMusicMuted(!this.music.checked));
    this.effects.addEventListener('change', () => this.sound.setEffectsMuted(!this.effects.checked));
    this.musicVolume.addEventListener('input', () => {
      this.sound.setMusicVolume(Number(this.musicVolume.value) / 100);
      if (this.sound.settings.musicMuted) this.sound.setMusicMuted(false);
    });
    this.effectsVolume.addEventListener('input', () => {
      this.sound.setVolume(Number(this.effectsVolume.value) / 100);
      if (this.sound.settings.effectsMuted) this.sound.setEffectsMuted(false);
    });

    const row = (input: HTMLInputElement, label: string, slider?: HTMLInputElement): HTMLElement =>
      el('div', { className: 'sound-panel__row' }, [
        el('label', { className: 'sound-panel__label' }, [input, el('span', { text: label })]),
        slider ?? null,
      ]);
    // Изображение: атмосферные эффекты (свет свечи, пылинки) — не звук, поэтому не гаснут вместе с ним
    this.atmosphereInput = atmosphere ? checkbox('atmosphere-enabled') : null;
    const view = this.atmosphereInput
      ? el('div', { className: 'sound-panel__extra' }, [
          el('label', { className: 'sound-panel__label' }, [this.atmosphereInput, el('span', { text: i18n.t('view.atmosphere') })]),
        ])
      : null;
    this.atmosphereInput?.addEventListener('change', () => atmosphere?.setEnabled(this.atmosphereInput?.checked ?? true));
    this.panel = el('div', {
      className: 'sound-panel',
      attrs: { id: panelId, role: 'group', 'aria-label': i18n.t('sound.settings'), 'data-testid': 'sound-panel' },
    }, [
      row(this.all, i18n.t('sound.all')),
      row(this.music, i18n.t('sound.music'), this.musicVolume),
      row(this.effects, i18n.t('sound.effects'), this.effectsVolume),
      view,
    ]);
    this.panel.hidden = true;
    this.root = el('div', { className: 'sound-control' }, [this.button, this.panel]);

    // Панель закрывается касанием вне её и клавишей Esc
    document.addEventListener('pointerdown', (event) => {
      if (this.open && !this.root.contains(event.target as Node)) this.setOpen(false);
    });
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.open) {
        event.stopPropagation();
        this.setOpen(false);
        this.button.focus();
      }
    });
    this.sound.onChange(() => this.render());
    atmosphere?.onChange(() => this.render());
    this.render();
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.panel.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
  }

  private render(): void {
    const { muted, volume, effectsMuted, musicMuted, musicVolume } = this.sound.settings;
    const musicOn = !musicMuted && musicVolume > 0;
    const effectsOn = !effectsMuted && volume > 0;
    const audible = !muted && (musicOn || effectsOn);
    this.button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SPEAKER}${audible ? WAVES : CROSS}</svg>`;
    this.button.dataset['audible'] = String(audible);
    this.all.checked = !muted;
    this.music.checked = !musicMuted;
    this.effects.checked = !effectsMuted;
    this.musicVolume.value = String(Math.round(musicVolume * 100));
    this.effectsVolume.value = String(Math.round(volume * 100));
    // При выключенном звуке целиком отдельные переключатели недоступны
    for (const input of [this.music, this.effects, this.musicVolume, this.effectsVolume]) input.disabled = muted;
    this.panel.classList.toggle('is-muted', muted);
    if (this.atmosphereInput && this.atmosphere) this.atmosphereInput.checked = this.atmosphere.enabled;
  }
}
