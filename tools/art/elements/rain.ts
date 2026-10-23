import { defs, ellipse, ink, inkPath, linear, svg, type ElementArt } from '../lib';
import { CLOUD_SOFT, cloud, cloudDefs, rainStreaks } from '../kit';

/**
 * Дождь: тяжёлая серая туча, из неё косо падает дождь на мокрую поверхность.
 * Капли — светлые штрихи (ловят свет), внизу лужица с расходящимися кольцами и брызгами.
 * Туча темнее и ниже обычного облака, брюхо почти чёрное.
 */

const PUFFS: readonly (readonly [number, number, number])[] = [
  [70, 92, 26],
  [186, 90, 28],
  [104, 70, 32],
  [148, 62, 34],
  [126, 46, 24],
  [92, 100, 26],
  [140, 98, 30],
  [176, 104, 22],
  [52, 104, 16],
  [206, 106, 16],
];

function render(): string {
  const extra = [
    CLOUD_SOFT,
    cloudDefs('r', { light: '#cfcac0', body: '#868a8a', dark: '#2f363a' }),
    linear('rain-pool', [0, 210], [0, 236], [
      [0, '#3c4c50', 0.85],
      [1, '#1d2a2e', 0.6],
    ]),
  ].join('');
  const rings = [
    [92, 222, 12],
    [150, 226, 16],
    [190, 218, 8],
  ]
    .map(([x, y, r], i) =>
      inkPath(ink(ellipse([x!, y!], r!, r! * 0.22, 14, 0.1, Math.PI - 0.1), { width: 0.9, taper: [0.3, 0.3], shade: 0, seed: 60 + i }), '#cfd8d2', 0.6) +
      inkPath(ink(ellipse([x!, y!], r! * 0.55, r! * 0.12, 10, Math.PI + 0.3, Math.PI * 2 - 0.3), { width: 0.7, taper: [0.3, 0.3], shade: 0, seed: 70 + i }), '#0e1719', 0.5))
    .join('');
  const splashes = [
    [92, 220],
    [150, 223],
    [190, 216],
    [64, 226],
  ]
    .map(([x, y], i) => `<path d="${ink([[x! - 4, y!], [x! - 6, y! - 6]], { width: 0.9, taper: [0.1, 0.6], shade: 0, seed: 80 + i })}${ink([[x! + 4, y!], [x! + 6, y! - 6]], { width: 0.9, taper: [0.1, 0.6], shade: 0, seed: 85 + i })}" fill="#d8e2dc" fill-opacity="0.7"/><circle cx="${x! - 1}" cy="${y! - 9}" r="1.1" fill="#e6eee8" fill-opacity="0.8"/>`)
    .join('');
  return svg(`${defs(extra)}
  <!-- Мокрая поверхность -->
  <ellipse cx="130" cy="224" rx="96" ry="14" fill="url(#rain-pool)" filter="url(#wash)"/>
  <ellipse cx="96" cy="222" rx="22" ry="2.2" fill="#e8dcc0" fill-opacity="0.4" filter="url(#blur-2)"/>
  ${rings}
  <!-- Косой дождь: дальний бледнее, ближний ярче -->
  ${rainStreaks([50, 120, 200, 210], 40, -0.28, 5, '#7a8c92', 0.55)}
  ${rainStreaks([56, 118, 206, 214], 30, -0.3, 9, '#2f4652', 0.8)}
  ${splashes}
  ${cloud('r', PUFFS, 120)}
  `);
}

export const rain: ElementArt = { id: 'rain', render };
