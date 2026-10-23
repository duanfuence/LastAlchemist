import { HIGHLIGHT, candleReflection, defs, ellipse, ink, inkPath, linear, polyD, radial, rimDark, svg, type ElementArt, type Pt } from '../lib';

/**
 * Стекло: шар толстого старого стекла и два осколка рядом.
 * Стекло бесцветно и видно только по оптике: кромка темнеет (Френель), внизу шара —
 * перевёрнутая светлая страница, свеча отражается дважды (снаружи и изнутри),
 * а на стол за шаром стекло собирает свет в яркое пятно-фокус. Лёгкий зеленоватый тон
 * старого стекла заметен только по краям и на сколах.
 */

function render(): string {
  const extra = [
    radial('glass-tint', [128, 132], 62, [
      [0, '#e6eee0', 0.08],
      [0.75, '#a9bfae', 0.2],
      [1, '#5f7a6a', 0.45],
    ]),
    linear('glass-refraction', [0, 150], [0, 200], [
      [0, '#20302a', 0],
      [0.35, '#20302a', 0.45],
      [0.55, '#efe3c4', 0.7],
      [0.85, '#efe3c4', 0.25],
      [1, '#efe3c4', 0],
    ]),
    radial('focus', [168, 222], 26, [
      [0, '#fff8de', 0.95],
      [0.4, '#ffeab8', 0.5],
      [1, '#ffeab8', 0],
    ]),
    rimDark('glass-edge', 7, '#2e463a', 0.75),
    `<clipPath id="ball-clip"><circle cx="128" cy="140" r="62"/></clipPath>`,
  ].join('');
  const shard = (pts: Pt[], seed: number): string =>
    `<path d="${polyD(pts)}" fill="#c8dccd" fill-opacity="0.35"/>
    <path d="${polyD(pts)}" fill="#000" filter="url(#glass-edge)"/>
    ${inkPath(ink(pts, { width: 0.9, closed: true, shade: 1, seed, raw: true }), '#1d2e26', 0.8)}
    <path d="M${pts[0]![0]} ${pts[0]![1]}L${pts[1]![0]} ${pts[1]![1]}" stroke="${HIGHLIGHT}" stroke-width="1" stroke-opacity="0.8"/>`;
  return svg(`${defs(extra)}
  <!-- Тень шара светлая: свет проходит насквозь и собирается в фокус -->
  <ellipse cx="146" cy="218" rx="64" ry="10" fill="#1d3634" fill-opacity="0.35" filter="url(#blur-4)"/>
  <ellipse cx="166" cy="220" rx="22" ry="5" fill="url(#focus)"/>
  <ellipse cx="128" cy="204" rx="26" ry="4" fill="#0d0a08" fill-opacity="0.5" filter="url(#blur-2)"/>
  <!-- Шар -->
  <circle cx="128" cy="140" r="62" fill="url(#glass-tint)"/>
  <g clip-path="url(#ball-clip)">
    <rect x="60" y="140" width="136" height="64" fill="url(#glass-refraction)" filter="url(#blur-2)"/>
    <!-- Перевёрнутое отражение окна-свечи внутри -->
    <ellipse cx="156" cy="176" rx="10" ry="6" fill="${HIGHLIGHT}" fill-opacity="0.55" filter="url(#blur-2)"/>
    <circle cx="128" cy="140" r="62" fill="#000" filter="url(#glass-edge)"/>
    <path d="${ink(ellipse([128, 140], 56, 56, 24, Math.PI * 0.95, Math.PI * 1.45), { width: 3, taper: [0.4, 0.4], shade: 0, seed: 7 })}" fill="${HIGHLIGHT}" fill-opacity="0.5" filter="url(#blur-1)"/>
    <path d="${ink(ellipse([128, 140], 57, 57, 20, Math.PI * 0.05, Math.PI * 0.45), { width: 2.4, taper: [0.4, 0.4], shade: 0, seed: 8 })}" fill="#d8e8dc" fill-opacity="0.45" filter="url(#blur-1)"/>
  </g>
  ${candleReflection(98, 106, 8, 0.95)}
  <circle cx="160" cy="172" r="2.2" fill="${HIGHLIGHT}" fill-opacity="0.9"/>
  ${inkPath(ink(ellipse([128, 140], 62, 62, 40, -Math.PI * 0.6, Math.PI * 1.1), { width: 2, taper: [0.25, 0.25], shade: 1.2, seed: 9 }), '#1d2e26', 0.9)}
  ${inkPath(ink(ellipse([128, 140], 62, 62, 20, Math.PI * 1.15, Math.PI * 1.35), { width: 0.9, taper: [0.4, 0.4], shade: 0, seed: 10 }), '#1d2e26', 0.6)}
  ${shard([[40, 226], [62, 210], [72, 224], [58, 232]], 11)}
  ${shard([[196, 230], [214, 212], [226, 226], [210, 234]], 12)}
  `);
}

export const glass: ElementArt = { id: 'glass', render };
