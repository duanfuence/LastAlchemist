import { HIGHLIGHT, INK, candleReflection, defs, ellipse, groundShadow, ink, inkPath, linear, relief, rimDark, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';

/**
 * Песочные часы: две колбы из старого стекла в раме из тёмного точёного дерева.
 * Наверху песка осталось немного, тонкая струйка падает в горку внизу.
 * Стекло показано оптикой (кромки, блики свечи), дерево — рельефом волокон и точёными шарами.
 */

function render(): string {
  const bulb: Pt[] = [
    [86, 50], [170, 50], [168, 82], [150, 112], [132, 128], [150, 144], [168, 174], [170, 206], [86, 206], [88, 174], [106, 144], [124, 128], [106, 112], [88, 82],
  ];
  const d = smooth(bulb);
  const extra = [
    linear('frame', [60, 0], [196, 0], [
      [0, '#7a4e2c'],
      [0.35, '#4a2c16'],
      [1, '#1c0e06'],
    ]),
    linear('hg-sand', [0, 150], [0, 206], [
      [0, '#e6c88a'],
      [1, '#9a7442'],
    ]),
    relief('r-frame', { frequency: '0.2 0.02', octaves: 3, roughness: 0.6, dome: 3, depth: 8, gloss: 0.6, sharpness: 14, strength: 1, seed: 191 }),
    rimDark('hg-edge', 6, '#2e3e36', 0.6),
    `<clipPath id="bulb-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  const plate = (y: number, seed: number): string => {
    const shape: Pt[] = [[62, y - 7], [194, y - 7], [200, y - 4], [200, y + 4], [194, y + 7], [62, y + 7], [56, y + 4], [56, y - 4]];
    return `<path d="${smooth(shape)}" fill="url(#frame)" filter="url(#r-frame)"/>` +
      inkPath(ink(shape, { width: 1.4, closed: true, shade: 1, seed }), INK, 0.9) +
      `<path d="M62 ${y - 5} H194" stroke="#d8a874" stroke-opacity="0.5" stroke-width="1"/>`;
  };
  const post = (x: number, seed: number): string => {
    const shape: Pt[] = [[x - 4, 50], [x + 4, 50], [x + 5, 70], [x + 3, 100], [x + 6, 128], [x + 3, 156], [x + 5, 186], [x + 4, 206], [x - 4, 206], [x - 5, 186], [x - 3, 156], [x - 6, 128], [x - 3, 100], [x - 5, 70]];
    return `<path d="${smooth(shape)}" fill="url(#frame)" filter="url(#r-frame)"/>` + inkPath(ink(shape, { width: 1.2, closed: true, shade: 1.1, seed }), INK, 0.85);
  };
  const lower = smooth([[92, 206], [100, 180], [118, 166], [128, 162], [138, 166], [156, 180], [164, 206]]);
  const upper = smooth([[106, 100], [150, 100], [140, 116], [132, 126], [124, 126], [116, 116]]);
  return svg(`${defs(extra)}
  ${groundShadow(130, 224, 80, 7)}
  ${post(70, 1)}
  <!-- Стекло, песок -->
  <path d="${d}" fill="#c8d6cc" fill-opacity="0.22"/>
  <g clip-path="url(#bulb-clip)">
    <path d="${upper}" fill="url(#hg-sand)"/>
    <path d="${lower}" fill="url(#hg-sand)"/>
    <path d="${lower}" fill="#000" filter="url(#core-cold)"/>
    <path d="M127 126 L129 126 L129.4 166 L126.6 166 Z" fill="#c9a868"/>
    ${stipple({ count: 60, bounds: [118, 156, 140, 170], density: (x, y) => Math.max(0, 1 - Math.hypot((x - 128) / 10, (y - 164) / 5)), radius: (_x, _y, r) => 0.4 + r() * 0.5, color: '#f2dca8', seed: 3 })}
    <path d="${d}" fill="#000" filter="url(#hg-edge)"/>
  </g>
  ${candleReflection(100, 74, 4.5, 0.9)}
  ${candleReflection(104, 184, 3.5, 0.7)}
  <path d="${smooth([[160, 66], [164, 80], [156, 100], [158, 82]])}" fill="${HIGHLIGHT}" fill-opacity="0.4"/>
  ${inkPath(ink(bulb, { width: 1.5, closed: true, shade: 1.2, seed: 4 }), '#1d2e26', 0.85)}
  ${post(186, 2)}
  ${plate(46, 5)}
  ${plate(210, 6)}
  <!-- Точёные ножки -->
  ${[64, 192].map((x, i) => `<ellipse cx="${x}" cy="${222}" rx="8" ry="5" fill="url(#frame)" filter="url(#r-frame)"/>${inkPath(ink(ellipse([x, 222], 8, 5, 14), { width: 1, closed: true, shade: 1, seed: 7 + i }), INK, 0.8)}`).join('')}
  `);
}

export const hourglass: ElementArt = { id: 'hourglass', render };
