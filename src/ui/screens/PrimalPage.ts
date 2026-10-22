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
      el('h3', { className: 'element-card__name', text: text.name }),
      el('p', { className: 'element-card__desc', text: text.description }),
    ]);
  });

  const closeButton = el('button', {
    className: 'ghost-button',
    text: i18n.t('primal.close'),
    attrs: { type: 'button', 'data-testid': 'close-book' },
  });
  closeButton.addEventListener('click', () => actions.onClose());

  return el('section', { className: 'primal-page', attrs: { 'data-screen': 'primal' } }, [
    el('h2', { className: 'title', text: i18n.t('primal.title') }),
    uiArt('divider', 'divider'),
    el('p', { className: 'lead', text: i18n.t('primal.intro') }),
    el('ul', { className: 'element-grid' }, cards),
    el('p', { className: 'hand-note', text: i18n.t('primal.margin') }),
    closeButton,
  ]);
}
