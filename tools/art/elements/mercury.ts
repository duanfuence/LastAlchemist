import { HIGHLIGHT, INK, candleReflection, defs, ellipse, ink, inkPath, smooth, svg, type ElementArt, type Pt } from '../lib';
import { linearBox } from '../kit';

/**
 * Ртуть: тяжёлые капли жидкого металла — большая лужица и россыпь шариков.
 * Ртуть — идеальное зеркало: сверху отражается тёмный свод лаборатории, по «горизонту»
 * резко сменяется светлой полосой страницы, снизу снова тьма; пламя свечи — острой точкой.
 * Поверхностное натяжение: капли выпуклые, с плоским дном и тонкой тенью касания.
 */

function blob(c: Pt, rx: number, ry: number, seed: number): string {
  const top = ellipse(c, rx, ry, 20, Math.PI, Math.PI * 2);
  const shape: Pt[] = [...top, [c[0] + rx * 0.96, c[1] + ry * 0.18], [c[0] + rx * 0.6, c[1] + ry * 0.32], [c[0], c[1] + ry * 0.36], [c[0] - rx * 0.6, c[1] + ry * 0.32], [c[0] - rx * 0.96, c[1] + ry * 0.18]];
  const d = smooth(shape);
  return `<ellipse cx="${c[0] + rx * 0.1}" cy="${c[1] + ry * 0.36}" rx="${rx * 1.05}" ry="${Math.max(2, ry * 0.16)}" fill="#0b0908" fill-opacity="0.55" filter="url(#blur-1)"/>
    <path d="${d}" fill="url(#mirror)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm-thin)"/>
    ${inkPath(ink(shape, { width: Math.max(0.6, rx * 0.03), closed: true, shade: 1, seed }), INK, 0.85)}`;
}

function render(): string {
  const extra = linearBox('mirror', [0.5, 0], [0.5, 1], [
    [0, '#3a3a3a'],
    [0.28, '#7c7c78'],
    [0.46, '#d8d4c8'],
    [0.5, '#f4efe2'],
    [0.52, '#4a4844'],
    [0.75, '#24231f'],
    [1, '#0e0d0c'],
  ]);
  return svg(`${defs(extra)}
  <g transform="translate(128 214) scale(1.12) translate(-128 -214)">
  <ellipse cx="132" cy="212" rx="92" ry="10" fill="#1d3634" fill-opacity="0.3" filter="url(#blur-8)"/>
  ${blob([120, 192], 74, 50, 1)}
  ${candleReflection(90, 166, 6, 1)}
  ${blob([196, 206], 18, 11, 2)}
  ${blob([52, 208], 13, 8, 3)}
  ${blob([216, 222], 8, 5, 4)}
  ${blob([172, 224], 6, 4, 5)}
  ${blob([34, 224], 5, 3.4, 6)}
  ${[[196, 206, 18, 11], [52, 208, 13, 8]].map(([x, y, rx, ry]) => `<circle cx="${x! - rx! * 0.4}" cy="${y! - ry! * 0.45}" r="${Math.max(0.8, rx! * 0.1)}" fill="${HIGHLIGHT}"/>`).join('')}
  </g>
  `);
}

export const mercury: ElementArt = { id: 'mercury', render };
