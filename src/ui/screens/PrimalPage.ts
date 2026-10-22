import type { Translator } from '../../i18n';
import { elementArt, uiArt } from '../art';
import { el } from '../dom';

/** Начальные элементы. На этапе 1 список будет браться из базы контента. */
const PRIMAL_ELEMENTS = ['water', 'fire', 'earth', 'air'] as const;

export interface PrimalPageActions {
  onClose(): void;
}

export function renderPrimalPage(i18n: Translator, actions: PrimalPageActions): HTMLElement {
  const cards = PRIMAL_ELEMENTS.map((id) => {
    const text = i18n.element(id);
    return el('li', { className: 'element-card', attrs: { 'data-element': id } }, [
      el('div', { className: 'element-card__art' }, [
        uiArt('medallion'),
        elementArt(id, 'art--figure'),
      ]),
      el('div', { className: 'element-card__text' }, [
        el('h3', { className: 'element-card__name', text: text.name }),
        el('p', { className: 'element-card__desc', text: text.description }),
      ]),
    ]);
  });

  const closeButton = el('button', {
    className: 'ghost-button primal-page__close',
    text: i18n.t('primal.close'),
    attrs: { type: 'button', 'data-testid': 'close-book' },
  });
  closeButton.addEventListener('click', () => actions.onClose());

  // Вступление — левая страница разворота; в одностраничной раскладке пометка и кнопка идут после карточек
  return el('section', { className: 'primal-page', attrs: { 'data-screen': 'primal' } }, [
    el('div', { className: 'primal-page__intro' }, [
      el('h2', { className: 'title', text: i18n.t('primal.title') }),
      uiArt('divider', 'divider'),
      el('p', { className: 'lead', text: i18n.t('primal.intro') }),
      el('p', { className: 'hand-note primal-page__note', text: i18n.t('primal.margin') }),
      closeButton,
    ]),
    el('ul', { className: 'element-grid' }, cards),
  ]);
}
