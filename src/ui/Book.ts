import type { Translator } from '../i18n';
import { uiArt } from './art';
import { el } from './dom';
import { renderPrimalPage } from './screens/PrimalPage';
import { renderTitlePage } from './screens/TitlePage';
import { ScrollEdgeWatcher } from './scrollEdges';

export type BookPage = 'title' | 'primal';

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CHEVRON_SVG =
  '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2 4.5 L7 9.5 L12 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Ждёт окончания собственной анимации элемента (анимации потомков игнорируются).
 * Страховочный таймер не даёт книге «застрять», если событие не придёт.
 */
function afterOwnAnimation(node: HTMLElement, fallbackMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      node.removeEventListener('animationend', onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (event: AnimationEvent): void => {
      if (event.target === node) finish();
    };
    const timer = setTimeout(finish, fallbackMs);
    node.addEventListener('animationend', onEnd);
  });
}

/** Книга: страница пергамента с рамкой и переключением разворотов. */
export class Book {
  readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly scrollEdges: ScrollEdgeWatcher;
  private current: BookPage | null = null;
  private turning = false;

  constructor(private readonly i18n: Translator) {
    this.content = el('div', { className: 'page__content' });
    const corners = (['tl', 'tr', 'bl', 'br'] as const).map((pos) =>
      uiArt('corner', `page__corner page__corner--${pos}`),
    );
    const scrollHint = this.createScrollHint();
    const page = el('article', { className: 'page' }, [...corners, this.content, scrollHint]);
    this.root = el('main', { className: 'desk' }, [page]);

    this.scrollEdges = new ScrollEdgeWatcher(this.content, page);
    this.scrollEdges.onChange(({ moreBelow }) => {
      scrollHint.hidden = !moreBelow;
    });
  }

  get page(): BookPage | null {
    return this.current;
  }

  show(page: BookPage): void {
    if (page === this.current || this.turning) return;
    const first = this.current === null;
    this.current = page;
    if (first || prefersReducedMotion()) {
      this.swap(page, !first);
      return;
    }
    this.turning = true;
    this.content.classList.remove('is-entering');
    this.content.classList.add('is-leaving');
    void afterOwnAnimation(this.content).then(() => {
      this.content.classList.remove('is-leaving');
      this.swap(page, true);
      this.turning = false;
    });
  }

  private swap(page: BookPage, animate: boolean): void {
    const view =
      page === 'title'
        ? renderTitlePage(this.i18n, { onOpen: () => this.show('primal') })
        : renderPrimalPage(this.i18n, { onClose: () => this.show('title') });
    this.content.replaceChildren(view);
    this.content.scrollTop = 0;
    this.content.dataset['page'] = page;
    this.scrollEdges.contentChanged();
    if (animate) {
      this.content.classList.add('is-entering');
      void afterOwnAnimation(this.content).then(() => this.content.classList.remove('is-entering'));
      // После перелистывания фокус переходит на главное действие новой страницы
      view.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    }
  }

  /** Подсказка о продолжении страницы: видна, пока ниже есть содержимое; по нажатию листает. */
  private createScrollHint(): HTMLButtonElement {
    const hint = el('button', {
      className: 'scroll-hint',
      attrs: { type: 'button', 'aria-label': this.i18n.t('page.scrollHintLabel'), 'data-testid': 'scroll-hint' },
    });
    hint.hidden = true;
    hint.append(el('span', { text: this.i18n.t('page.scrollHint') }));
    hint.insertAdjacentHTML('beforeend', CHEVRON_SVG);
    hint.addEventListener('click', () => {
      this.content.scrollBy({
        top: Math.round(this.content.clientHeight * 0.75),
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    });
    return hint;
  }
}
