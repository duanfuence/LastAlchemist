import type { StoryEntryId } from '../core/progress/story';
import type { Translator, UiKey } from '../i18n';
import { elementArt, uiArt } from './art';
import { el } from './dom';

export interface StoryPageOptions {
  /** Рисунок записи (путь из базы контента), например тайный элемент у финала. */
  art?: (entry: StoryEntryId) => string | undefined;
  /** Подпись кнопки на последней странице: «Вернуться к опытам» или «Закрыть запись». */
  closeLabel: UiKey;
  onClose(): void;
}

/**
 * Сюжетная запись — отдельный лист, положенный поверх страниц книги.
 * Несколько записей подряд листаются кнопкой; последняя закрывает лист.
 * Закрывается кнопкой и клавишей Esc; фокус возвращается туда, где был.
 */
export class StoryPage {
  readonly root: HTMLElement;
  private readonly sheet: HTMLElement;
  private index = 0;
  private readonly returnFocus: HTMLElement | null;

  constructor(
    private readonly i18n: Translator,
    private readonly entries: readonly StoryEntryId[],
    private readonly options: StoryPageOptions,
  ) {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.sheet = el('div', { className: 'story__sheet' });
    this.root = el('div', {
      className: 'story',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'story-title', 'data-testid': 'story' },
    }, [this.sheet]);
    this.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      this.close();
    });
    this.render();
  }

  private render(): void {
    const entry = this.entries[this.index]!;
    const last = this.index === this.entries.length - 1;
    const t = (suffix: string): string => this.i18n.t(`story.${entry}.${suffix}` as UiKey);
    const art = this.options.art?.(entry);
    const paragraphs = t('text').split('\n\n').map((text) => el('p', { className: 'story__paragraph', text }));
    const button = el('button', {
      className: last ? 'seal-button story__button' : 'ghost-button story__button',
      text: this.i18n.t(last ? this.options.closeLabel : 'story.next'),
      attrs: { type: 'button', 'data-testid': last ? 'story-close' : 'story-next' },
    });
    button.addEventListener('click', () => {
      if (last) {
        this.close();
        return;
      }
      this.index += 1;
      this.render();
    });
    this.root.dataset['entry'] = entry;
    this.sheet.replaceChildren(
      art ? elementArt(art, 'story__art') : uiArt('divider', 'story__ornament'),
      el('p', { className: 'overline story__overline', text: t('overline') }),
      el('h2', { className: 'story__title', text: t('title'), attrs: { id: 'story-title' } }),
      el('div', { className: 'story__text' }, paragraphs),
      el('p', { className: 'hand-note story__sign', text: t('sign') }),
      button,
    );
    // Новая страница записи — с начала, фокус на её кнопке
    this.sheet.scrollTop = 0;
    this.root.classList.remove('is-turning');
    void this.root.offsetWidth;
    this.root.classList.add('is-turning');
    button.focus({ preventScroll: true });
  }

  private close(): void {
    this.root.remove();
    this.returnFocus?.focus({ preventScroll: true });
    this.options.onClose();
  }
}
