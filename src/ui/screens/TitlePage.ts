import type { Translator } from '../../i18n';
import { uiArt } from '../art';
import { el } from '../dom';

export interface TitlePageActions {
  onOpen(): void;
}

export function renderTitlePage(i18n: Translator, actions: TitlePageActions): HTMLElement {
  const openButton = el('button', {
    className: 'seal-button',
    text: i18n.t('launch.open'),
    attrs: { type: 'button', 'data-testid': 'open-book' },
  });
  openButton.addEventListener('click', () => actions.onOpen());

  return el('section', { className: 'title-page', attrs: { 'data-screen': 'title' } }, [
    el('p', { className: 'overline', text: i18n.t('launch.overline') }),
    uiArt('emblem', 'title-page__emblem', i18n.t('launch.emblemLabel')),
    el('div', { className: 'title-page__text' }, [
      el('div', { className: 'title-page__heading' }, [
        el('h1', { className: 'title', text: i18n.t('app.title') }),
        uiArt('divider', 'divider'),
        el('p', { className: 'lead', text: i18n.t('launch.subtitle') }),
      ]),
      openButton,
      el('p', { className: 'hand-note', text: i18n.t('launch.footnote') }),
    ]),
  ]);
}
