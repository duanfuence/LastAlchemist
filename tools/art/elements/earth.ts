import { INK, defs, groundShadow, ink, inkPath, linear, relief, rng, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';
import { lump } from '../kit';

/**
 * Земля: ком тёмной плодородной земли, только что вынутый из грядки.
 * Сверху пробивается трава, с отломленного бока свисают корешки, вокруг осыпались крошки.
 * Материал — комковатая влажная почва: крупный рельеф без блеска, тёплые комья к свету.
 */

const CLOD = lump([128, 176], 76, 46, 17, 0.7, 0.14, 18);

function grass(): string {
  const random = rng(41);
  const blades = Array.from({ length: 19 }, (_, i) => {
    const x = 84 + i * 4.6 + (random() - 0.5) * 3;
    const base = 142 - Math.sin(((x - 84) / 88) * Math.PI) * 12;
    const h = 26 + random() * 34;
    const lean = (random() - 0.4) * 22;
    const pts: Pt[] = [[x, base + 4], [x + lean * 0.3, base - h * 0.5], [x + lean, base - h]];
    const color = random() > 0.4 ? '#5d7a3a' : random() > 0.5 ? '#7c9a48' : '#3f5a2a';
    return inkPath(ink(pts, { width: 2.6 + random(), taper: [0, 0.9], shade: 0.6, seed: 300 + i }), color) +
      inkPath(ink(pts, { width: 0.6, taper: [0, 0.9], shade: 0, seed: 330 + i }), INK, 0.35);
  });
  return blades.join('');
}

function roots(): string {
  const items: Pt[][] = [
    [[176, 196], [184, 206], [182, 218], [188, 228]],
    [[188, 184], [198, 192], [202, 204]],
    [[166, 206], [170, 216], [166, 224]],
  ];
  return items
    .map((r, i) => inkPath(ink(r, { width: 1.6 - i * 0.3, taper: [0.1, 0.9], shade: 0, pressure: 0.4, seed: 350 + i }), '#b49470', 0.9) +
      inkPath(ink(r, { width: 0.5, taper: [0.1, 0.9], shade: 0, seed: 360 + i }), INK, 0.5))
    .join('');
}

function render(): string {
  const d = smooth(CLOD);
  const extra = [
    linear('earth-body', [80, 130], [180, 226], [
      [0, '#7a5638'],
      [0.45, '#4a3020'],
      [1, '#1c120b'],
    ]),
    relief('r-earth', { frequency: 0.11, octaves: 4, roughness: 1, dome: 12, depth: 22, gloss: 0.06, strength: 1, seed: 23 }),
    `<clipPath id="earth-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  const crumbs = [[44, 222, 3.4], [58, 228, 2.2], [204, 224, 3], [214, 230, 1.8], [190, 232, 2.4]]
    .map(([x, y, r], i) => {
      const pts = lump([x!, y!], r! * 1.3, r!, 400 + i, 0.6, 0.2, 8);
      return `<path d="${smooth(pts)}" fill="#5a3c26" filter="url(#r-earth)"/>${inkPath(ink(pts, { width: 0.8, closed: true, shade: 1, seed: 410 + i }), INK, 0.7)}`;
    })
    .join('');
  return svg(`${defs(extra)}
  ${groundShadow(132, 214, 82, 9)}
  ${roots()}
  <path d="${d}" fill="url(#earth-body)" filter="url(#r-earth)"/>
  <g clip-path="url(#earth-clip)">
    ${stipple({
      count: 160,
      bounds: [50, 130, 206, 222],
      density: (x, y) => Math.max(0, 1 - (y - 130) / 50) * (x < 160 ? 1 : 0.4),
      radius: (_x, _y, r) => 0.4 + r() * 1,
      color: (_x, _y, r) => (r() > 0.6 ? '#a88a66' : '#7a5a3c'),
      seed: 33,
    })}
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  </g>
  ${inkPath(ink(CLOD, { width: 2, closed: true, shade: 1.1, seed: 19 }), INK, 0.9)}
  ${grass()}
  ${crumbs}
  `);
}

export const earth: ElementArt = { id: 'earth', render };
