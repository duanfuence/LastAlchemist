import { HIGHLIGHT, INK, defs, groundShadow, ink, inkPath, linear, polyD, relief, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';
import { lump } from '../kit';

/**
 * Камень: тяжёлый гранитный валун с отколотыми гранями и пятнами лишайника.
 * Материал — зернистый матовый камень: рельеф со слабым блеском, сколы — плоские грани
 * с резкой границей света, трещина уходит в тень. Рядом лежат два отколотых осколка.
 */

const BOULDER = lump([128, 172], 78, 54, 7, 0.72, 0.1, 16);

function render(): string {
  const d = smooth(BOULDER);
  const extra = [
    linear('stone-body', [70, 120], [190, 230], [
      [0, '#a39c8c'],
      [0.45, '#7b766b'],
      [1, '#3c3a36'],
    ]),
    relief('r-stone', { frequency: 0.055, octaves: 4, roughness: 0.65, dome: 22, depth: 18, gloss: 0.18, sharpness: 10, strength: 1, seed: 3 }),
    relief('r-chip', { frequency: 0.12, octaves: 3, roughness: 0.5, dome: 4, depth: 6, gloss: 0.15, seed: 5 }),
    `<clipPath id="stone-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  // Сколы: плоские грани — светлая к свече, тёмная в тени
  const facets: [Pt[], string, number][] = [
    [[[76, 150], [104, 126], [132, 122], [116, 150], [88, 164]], '#d9d2bf', 0.28],
    [[[150, 128], [186, 142], [200, 172], [170, 160]], '#1d2423', 0.3],
    [[[118, 196], [150, 186], [182, 200], [160, 222], [124, 224]], '#1d2423', 0.25],
  ];
  const facetPaths = facets.map(([pts, color, opacity]) => `<path d="${polyD(pts)}" fill="${color}" fill-opacity="${opacity}"/>`).join('');
  const crack = ink([[160, 128], [154, 146], [160, 160], [150, 178], [156, 194]], { width: 1.6, taper: [0.2, 0.5], shade: 0, pressure: 0.5, seed: 11 });
  const chip = (pts: Pt[], seed: number): string =>
    `<path d="${polyD(pts)}" fill="#7d776c" filter="url(#r-chip)"/><path d="${polyD(pts)}" fill="#000" filter="url(#core-cold)"/>${inkPath(ink(pts, { width: 1, closed: true, shade: 1, seed, raw: true }), INK, 0.8)}`;
  return svg(`${defs(extra)}
  <g transform="translate(128 214) scale(1.17) translate(-128 -214)">
  ${groundShadow(132, 213, 82, 8)}
  <path d="${d}" fill="url(#stone-body)" filter="url(#r-stone)"/>
  <g clip-path="url(#stone-clip)">
    ${facetPaths}
    <path d="${crack}" fill="#141614" fill-opacity="0.8"/>
    <path d="${ink([[159, 129], [153, 146], [159, 160]], { width: 0.6, taper: [0.2, 0.5], shade: 0, seed: 12 })}" fill="${HIGHLIGHT}" fill-opacity="0.35" transform="translate(-1.5 -0.5)"/>
    <!-- Лишайник на верхней, сухой стороне -->
    ${stipple({
      count: 420,
      bounds: [70, 116, 190, 170],
      density: (x, y) => Math.max(0, 1 - Math.hypot((x - 112) / 40, (y - 132) / 16)) + Math.max(0, 1 - Math.hypot((x - 168) / 18, (y - 148) / 10)),
      radius: (_x, _y, r) => 0.35 + r() * 0.8,
      color: (_x, _y, r) => (r() > 0.5 ? '#9aa070' : r() > 0.3 ? '#c4b46a' : '#6f7a52'),
      seed: 21,
    })}
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  </g>
  ${inkPath(ink(BOULDER, { width: 2.2, closed: true, shade: 1.1, seed: 9 }), INK, 0.9)}
  ${inkPath(ink([[104, 126], [116, 150], [88, 164]], { width: 0.9, taper: [0.3, 0.3], shade: 0, seed: 13 }), INK, 0.45)}
  ${inkPath(ink([[150, 186], [182, 200]], { width: 0.9, taper: [0.3, 0.3], shade: 0, seed: 14 }), INK, 0.45)}
  ${chip([[42, 218], [50, 207], [62, 209], [66, 220]], 31)}
  ${chip([[204, 220], [210, 211], [221, 213], [223, 222]], 32)}
  </g>
  `);
}

export const stone: ElementArt = { id: 'stone', render };
