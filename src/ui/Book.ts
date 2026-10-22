import type { Translator } from '../i18n';
import { uiArt } from './art';
import { el } from './dom';
import { renderPrimalPage } from './screens/PrimalPage';
import { renderTitlePage } from './screens/TitlePage';

export type BookPage = 'title' | 'primal';

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  private current: BookPage | null = null;
  private turning = false;

  constructor(private readonly i18n: Translator) {
    this.content = el('div', { className: 'page__content' });
    const corners = (['tl', 'tr', 'bl', 'br'] as const).map((pos) =>
      uiArt('corner', `page__corner page__corner--${pos}`),
    );
    this.root = el('main', { className: 'desk' }, [
      el('article', { className: 'page' }, [...corners, this.content]),
    ]);
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
    if (animate) {
      this.content.classList.add('is-entering');
      void afterOwnAnimation(this.content).then(() => this.content.classList.remove('is-entering'));
      // После перелистывания фокус переходит на главное действие новой страницы
      view.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    }
  }
}
