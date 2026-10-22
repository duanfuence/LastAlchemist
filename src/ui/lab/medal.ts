import type { ContentPack } from '../../core/content/types';
import { elementArt, uiArt } from '../art';
import { el } from '../dom';

/** Медальон элемента: кольцо и рисунок. Одинаков в списке, на столе и в уведомлениях. */
export function medal(content: ContentPack, elementId: string): HTMLElement {
  const def = content.elements.get(elementId);
  const node = el('span', { className: 'medal', attrs: { 'aria-hidden': 'true' } });
  node.append(uiArt('medallion', 'medal__ring'));
  if (def) node.append(elementArt(def.art, 'medal__figure'));
  return node;
}
