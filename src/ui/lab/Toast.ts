import { el } from '../dom';

export type ToastKind = 'discovery' | 'new-recipe' | 'known';

/** Короткое уведомление поверх стола. Новое заменяет предыдущее. */
export class Toast {
  readonly root: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.root = el('div', { className: 'toast-host', attrs: { 'aria-live': 'polite', 'data-testid': 'toast-host' } });
  }

  /** shortLabel — вариант для узких экранов, где полная фраза не помещается в панель. */
  show(kind: ToastKind, label: string, shortLabel: string, name: string, art: HTMLElement): void {
    this.hide();
    const toast = el('div', { className: `toast toast--${kind}`, attrs: { 'data-testid': 'toast', 'data-kind': kind } }, [
      art,
      el('span', { className: 'toast__text' }, [
        el('span', { className: 'toast__label toast__label--full', text: label }),
        el('span', { className: 'toast__label toast__label--short', text: shortLabel }),
        el('span', { className: 'toast__name', text: name }),
      ]),
    ]);
    this.root.replaceChildren(toast);
    this.timer = setTimeout(() => this.hide(), kind === 'discovery' ? 3200 : 2000);
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.root.replaceChildren();
  }
}
