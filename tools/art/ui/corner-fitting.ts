import { HIGHLIGHT, INK, defs, ink, inkPath, linear, radial, smooth, svg, type ElementArt, type Pt } from '../lib';

/**
 * Угловая накладка переплёта: старая медь с патиной, гравированная кайма и три кованых гвоздя.
 * Рисуется для левого верхнего угла; остальные углы получаются отражением в CSS,
 * поэтому блики идут вдоль рёбер, а не от одного источника света.
 */

/** Пластина: прямые края по краям обложки, фигурный внутренний край с лепестками. */
const PLATE: Pt[] = [
  [0, 0], [176, 0], [170, 18], [150, 26], [136, 44], [112, 50], [96, 70], [70, 74], [50, 96], [44, 120], [26, 136], [18, 160], [0, 176],
];

function rivet(x: number, y: number, r: number): string {
  return `<circle cx="${x + 1.5}" cy="${y + 2}" r="${r + 1.5}" fill="#120a06" fill-opacity="0.55"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#rivet)"/>
    <circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.28}" fill="${HIGHLIGHT}" fill-opacity="0.75"/>
    ${inkPath(ink([[x - r, y], [x, y + r], [x + r, y]], { width: 1, taper: [0.2, 0.2], shade: 0, seed: Math.round(x + y) }), INK, 0.6)}`;
}

function render(): string {
  const plate = smooth(PLATE);
  // Гравированная двойная кайма вдоль фигурного края
  const inner: Pt[] = [[150, 12], [140, 26], [126, 36], [104, 42], [88, 60], [64, 64], [44, 86], [36, 108], [24, 124], [12, 150]];
  const innerOffset: Pt[] = inner.map(([x, y]) => [x - 9, y - 9]);
  const extra = [
    linear('copper', [0, 0], [150, 150], [
      [0, '#c79a5c'],
      [0.35, '#94683a'],
      [0.7, '#5e3e1e'],
      [1, '#2e1d0e'],
    ]),
    radial('patina', [70, 60], 90, [
      [0, '#4f7a68', 0],
      [0.6, '#4f7a68', 0.25],
      [1, '#3a6050', 0.55],
    ]),
    radial('rivet', [0, 0], 1, [
      [0, '#e3bf84'],
      [0.6, '#9c6e3a'],
      [1, '#4a3016'],
    ]),
    `<clipPath id="plate-clip"><path d="${plate}"/></clipPath>`,
  ].join('').replace('id="rivet" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"', 'id="rivet" cx="0.4" cy="0.4" r="0.7"');
  return svg(`${defs(extra)}
  <!-- Тень пластины на коже -->
  <path d="${plate}" fill="#0a0503" fill-opacity="0.6" transform="translate(3 4)" filter="url(#blur-2)"/>
  <path d="${plate}" fill="url(#copper)" filter="url(#wash)"/>
  <!-- Патина собирается у фигурного края и в углублениях -->
  <path d="${plate}" fill="url(#patina)" filter="url(#wash)"/>
  <g clip-path="url(#plate-clip)">
    <!-- Блик вдоль наружных рёбер, потёртости -->
    <path d="M0 3 H170 M3 0 V170" stroke="#f0cf96" stroke-opacity="0.55" stroke-width="3" fill="none"/>
    <path d="M10 30 Q40 20 70 22 M22 60 Q30 40 50 34" stroke="#e6c48a" stroke-opacity="0.25" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>
  ${inkPath(ink(inner, { width: 1.6, taper: [0.1, 0.1], shade: 0, pressure: 0.3, seed: 5 }), '#24150a', 0.85)}
  ${inkPath(ink(innerOffset, { width: 1.2, taper: [0.1, 0.1], shade: 0, pressure: 0.3, seed: 6 }), '#24150a', 0.7)}
  ${inkPath(ink(PLATE.slice(1, -1), { width: 2.4, taper: [0.05, 0.05], shade: 0.6, seed: 7 }), INK, 0.9)}
  ${rivet(30, 30, 7)}
  ${rivet(96, 18, 5)}
  ${rivet(18, 96, 5)}
  `);
}

export const cornerFitting: ElementArt = { id: 'corner-fitting', render };
