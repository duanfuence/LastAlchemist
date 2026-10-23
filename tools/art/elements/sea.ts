import { HIGHLIGHT, INK, defs, ink, inkPath, linear, radial, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';

/**
 * Море: высокая волна, загибающаяся гребнем к свету.
 * Толща воды тёмная сине-зелёная, а у гребня, где вода тонкая, свет свечи проходит
 * насквозь — бирюзовое свечение. Пена — белая с холодной тенью, срывается брызгами.
 * Внизу — гладь с полосами отражений.
 */

const WAVE: Pt[] = [
  [18, 214], [24, 186], [44, 150], [72, 114], [104, 86], [138, 72], [164, 76], [176, 92], [166, 104], [150, 100],
  [138, 108], [146, 128], [170, 150], [204, 170], [238, 186], [240, 214],
];
const CREST: Pt[] = [[96, 92], [126, 74], [156, 72], [176, 88], [170, 102], [154, 98], [140, 104], [132, 96], [116, 92]];

function render(): string {
  const d = smooth(WAVE);
  const extra = [
    linear('sea-body', [60, 80], [200, 220], [
      [0, '#3c7f80'],
      [0.35, '#1f5258'],
      [0.75, '#0f2f38'],
      [1, '#081a20'],
    ]),
    radial('sea-glow', [130, 110], 50, [
      [0, '#9fd4c0', 0.85],
      [0.5, '#5fa39a', 0.4],
      [1, '#5fa39a', 0],
    ]),
    linear('foam-shade', [0, 70], [0, 110], [
      [0, '#fff8ec'],
      [1, '#a9b8b8'],
    ]),
    `<clipPath id="sea-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  const streaks = [180, 192, 204, 216]
    .map((y, i) => inkPath(ink([[30 + i * 10, y], [110, y - 3 + i], [200 - i * 6, y + 2]], { width: 1.4 - i * 0.2, taper: [0.4, 0.4], shade: 0, seed: 30 + i }), '#9cc6bc', 0.5))
    .join('');
  return svg(`${defs(extra)}
  <ellipse cx="130" cy="222" rx="110" ry="10" fill="#0c1a1c" fill-opacity="0.35" filter="url(#blur-4)"/>
  <path d="${d}" fill="url(#sea-body)" filter="url(#wash)"/>
  <g clip-path="url(#sea-clip)">
    <ellipse cx="122" cy="116" rx="46" ry="30" transform="rotate(-24 122 116)" fill="url(#sea-glow)"/>
    <!-- Течения внутри волны -->
    ${[0, 1, 2].map((i) => inkPath(ink([[40 + i * 20, 200 - i * 10], [80 + i * 16, 150 - i * 8], [120 + i * 10, 120 - i * 6]], { width: 1.6, taper: [0.4, 0.4], shade: 0, seed: 20 + i }), '#7fb8ac', 0.35)).join('')}
    ${streaks}
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
  </g>
  <!-- Пена на гребне и под ним -->
  <path d="${smooth(CREST)}" fill="url(#foam-shade)" filter="url(#wash-soft)"/>
  ${stipple({
    count: 160,
    bounds: [60, 60, 190, 140],
    density: (x, y) => Math.max(0, 1 - Math.hypot((x - 150) / 40, (y - 108) / 18)) + Math.max(0, 1 - Math.hypot((x - 110) / 50, (y - 92) / 8)) * 0.6,
    radius: (_x, _y, r) => 0.6 + r() * 1.6,
    color: (_x, _y, r) => (r() > 0.3 ? '#f4f2ea' : '#9fb6b4'),
    seed: 41,
  })}
  <!-- Брызги срываются с гребня -->
  ${stipple({
    count: 40,
    bounds: [150, 40, 216, 96],
    density: (x, y) => Math.max(0, 1 - Math.hypot((x - 182) / 30, (y - 70) / 26)),
    radius: (_x, _y, r) => 0.6 + r() * 1.3,
    color: '#eef2ec',
    seed: 42,
  })}
  ${inkPath(ink([[24, 186], [44, 150], [72, 114], [104, 86], [138, 72], [164, 76], [176, 92], [166, 104]], { width: 2, taper: [0.3, 0.2], shade: 0.4, seed: 5 }), '#0a2026', 0.85)}
  ${inkPath(ink([[150, 100], [138, 108], [146, 128], [170, 150], [204, 170], [238, 186]], { width: 2.2, taper: [0.2, 0.3], shade: 0.4, seed: 6 }), '#0a2026', 0.85)}
  <path d="${smooth([[108, 88], [130, 78], [150, 78], [132, 84]])}" fill="${HIGHLIGHT}" fill-opacity="0.8"/>
  ${inkPath(ink([[20, 214], [128, 220], [238, 214]], { width: 1.2, taper: [0.3, 0.3], shade: 0, seed: 7 }), INK, 0.4)}
  `);
}

export const sea: ElementArt = { id: 'sea', render };
