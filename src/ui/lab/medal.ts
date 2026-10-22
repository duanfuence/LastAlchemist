import type { ContentPack } from '../../core/content/types';
import { elementArt, elementArtKind } from '../art';
import { el } from '../dom';

/**
 * Изображение элемента на странице: рисунок и его тень на бумаге.
 * Одинаково в списке, на столе, при переносе и в уведомлениях.
 * Тень — отдельный слой: при переносе рисунок «приподнимается» над страницей, а тень остаётся на ней.
 */
export function medal(content: ContentPack, elementId: string): HTMLElement {
  const def = content.elements.get(elementId);
  const node = el('span', { className: 'medal', attrs: { 'aria-hidden': 'true' } });
  node.append(el('span', { className: 'medal__shadow' }));
  if (def) {
    node.dataset['art'] = elementArtKind(def.art);
    if (def.secret) node.dataset['rare'] = '';
    node.append(elementArt(def.art, 'medal__figure'));
  }
  return node;
}
