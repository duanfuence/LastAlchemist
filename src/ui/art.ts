import inkDefs from '../../assets/ui/ink-defs.svg?raw';
import emblem from '../../assets/ui/emblem.svg?raw';
import corner from '../../assets/ui/corner.svg?raw';
import divider from '../../assets/ui/divider.svg?raw';
import medallion from '../../assets/ui/medallion.svg?raw';
import { el } from './dom';

/**
 * Иллюстрации — собственные SVG-файлы проекта из assets/.
 * Встраиваются в документ, чтобы цвета туши и пергамента задавались темой (CSS),
 * а общие фильтры (#ink-wobble, #ink-hatch) подключались один раз.
 */

const UI_ART = { emblem, corner, divider, medallion } as const;
export type UiArtName = keyof typeof UI_ART;

const ELEMENT_ART = import.meta.glob<string>('../../assets/elements/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function elementArtSource(id: string): string {
  const source = ELEMENT_ART[`../../assets/elements/${id}.svg`];
  if (!source) throw new Error(`Нет иллюстрации для элемента "${id}"`);
  return source;
}

function artNode(svg: string, className: string, label?: string): HTMLElement {
  const node = el('div', { className: `art ${className}` });
  // Источник — файлы репозитория, не пользовательские данные.
  node.innerHTML = svg;
  const root = node.querySelector('svg');
  if (label) {
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', label);
  }
  root?.setAttribute('aria-hidden', 'true');
  root?.setAttribute('focusable', 'false');
  return node;
}

export function uiArt(name: UiArtName, className = '', label?: string): HTMLElement {
  return artNode(UI_ART[name], className, label);
}

export function elementArt(id: string, className = ''): HTMLElement {
  return artNode(elementArtSource(id), className);
}

/** Вставляет общие SVG-определения (фильтр пера, штриховка) один раз на документ. */
export function installArtDefinitions(doc: Document = document): void {
  if (doc.getElementById('ink-wobble')) return;
  const holder = doc.createElement('div');
  holder.innerHTML = inkDefs;
  const svg = holder.firstElementChild;
  if (svg) doc.body.prepend(svg);
}
