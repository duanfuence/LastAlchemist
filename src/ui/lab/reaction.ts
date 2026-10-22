import { el } from '../dom';

/**
 * Короткая реакция над местом соединения.
 * - discovery — вспышка, золотое кольцо и искры: новое знание;
 * - secret — то же сильнее, кольцо превращается в поворачивающийся знак;
 * - known — чернильный дымок без золота: результат уже известен.
 * Слой не перехватывает нажатия и удаляется сам; при prefers-reduced-motion реакции нет.
 */
export type ReactionKind = 'discovery' | 'secret' | 'known';

/** Время жизни слоя (мс) — с запасом относительно самой длинной CSS-анимации. */
export const REACTION_MS: Record<ReactionKind, number> = { discovery: 1100, secret: 1600, known: 650 };

const MOTES: Record<ReactionKind, number> = { discovery: 9, secret: 14, known: 0 };

const RING_SVG =
  '<svg class="reaction__ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="40"/></svg>';
/** Знак тайного открытия: круг, вписанный треугольник и внутренний круг. */
const SIGIL_SVG =
  '<svg class="reaction__ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="44"/><path d="M50 10 L84.6 70 L15.4 70 Z"/><circle cx="50" cy="50" r="20"/></svg>';

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** at — координаты в долях слоя (как у элементов стола). */
export function playReaction(layer: HTMLElement, at: { x: number; y: number }, kind: ReactionKind): HTMLElement | null {
  if (prefersReducedMotion()) return null;
  const node = el('div', {
    className: `reaction reaction--${kind}`,
    attrs: { 'aria-hidden': 'true', 'data-testid': 'reaction', 'data-kind': kind },
  });
  node.style.left = `${at.x * 100}%`;
  node.style.top = `${at.y * 100}%`;
  node.append(el('span', { className: 'reaction__flash' }));
  if (kind !== 'known') node.insertAdjacentHTML('beforeend', kind === 'secret' ? SIGIL_SVG : RING_SVG);
  const count = MOTES[kind];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    // Смещение — в долях размера элемента (--item-size), чтобы искры разлетались одинаково на любом экране
    const distance = 0.85 + Math.random() * 0.6;
    const mote = el('span', { className: 'reaction__mote' });
    mote.style.setProperty('--dx', (Math.cos(angle) * distance).toFixed(2));
    mote.style.setProperty('--dy', (Math.sin(angle) * distance).toFixed(2));
    mote.style.setProperty('--delay', `${Math.round(60 + Math.random() * 140)}ms`);
    node.append(mote);
  }
  layer.append(node);
  setTimeout(() => node.remove(), REACTION_MS[kind]);
  return node;
}
