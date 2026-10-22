import inkDefs from '../../assets/ui/ink-defs.svg?raw';
import emblem from '../../assets/ui/emblem.svg?raw';
import corner from '../../assets/ui/corner.svg?raw';
import divider from '../../assets/ui/divider.svg?raw';
import { el } from './dom';

/**
 * Иллюстрации — собственные файлы проекта из assets/.
 * Оформление книги (эмблема, уголки, разделитель) — SVG, встроенные в документ, чтобы цвет туши
 * задавался темой (CSS), а общие фильтры (#ink-wobble, #ink-hatch) подключались один раз.
 */

const UI_ART = { emblem, corner, divider } as const;
export type UiArtName = keyof typeof UI_ART;

/**
 * Иллюстрации элементов новой серии: растровые рисунки «тушь и акварель» (tools/art).
 * Подключаются как файлы сборки, а не встраиваются в код.
 */
const ELEMENT_PAINTINGS = import.meta.glob<string>('../../assets/elements/*.webp', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** Прежние рисунки элементов (тушь, SVG) — до перерисовки в новой технике. */
const ELEMENT_SKETCHES = import.meta.glob<string>('../../assets/elements/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export type ElementArtKind = 'painting' | 'sketch';

export function elementArtKind(path: string): ElementArtKind {
  return path.endsWith('.webp') ? 'painting' : 'sketch';
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

/** path — путь из базы контента относительно assets/, например "elements/water.webp". */
export function elementArt(path: string, className = ''): HTMLElement {
  const key = `../../assets/${path}`;
  if (elementArtKind(path) === 'painting') {
    const url = ELEMENT_PAINTINGS[key];
    if (!url) throw new Error(`Нет иллюстрации "${path}"`);
    const node = el('span', { className: `art art--painting ${className}` });
    node.append(el('img', { attrs: { src: url, alt: '', draggable: 'false', decoding: 'async' } }));
    return node;
  }
  const source = ELEMENT_SKETCHES[key];
  if (!source) throw new Error(`Нет иллюстрации "${path}"`);
  return artNode(source, `art--sketch ${className}`);
}

/** Вставляет общие SVG-определения (фильтр пера, штриховка) один раз на документ. */
export function installArtDefinitions(doc: Document = document): void {
  if (doc.getElementById('ink-wobble')) return;
  const holder = doc.createElement('div');
  holder.innerHTML = inkDefs;
  const svg = holder.firstElementChild;
  if (svg) doc.body.prepend(svg);
}
