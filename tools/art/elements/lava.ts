import { INK, defs, groundShadow, ink, inkPath, linear, radial, relief, rng, smooth, speck, svg, type ElementArt, type Pt } from '../lib';

/**
 * Лава: остывающий поток. Сверху — чёрная корка, расколотая на плиты; в трещинах
 * светится расплав. Спереди корка прорвана, и наружу выползает жидкий язык лавы
 * с морщинистой кожей. Свечение — только от расплава, корка остаётся тёмной и матовой.
 */

const FLOW: Pt[] = [[30, 206], [44, 178], [76, 160], [118, 150], [162, 152], [200, 164], [226, 186], [222, 210], [190, 218], [150, 222], [100, 224], [56, 220]];
const LOBE: Pt[] = [[96, 206], [124, 200], [156, 202], [180, 210], [194, 222], [180, 232], [146, 236], [110, 236], [80, 232], [70, 222], [80, 212]];

function render(): string {
  const d = smooth(FLOW);
  const extra = [
    linear('crust', [60, 150], [180, 224], [
      [0, '#5a4c44'],
      [0.5, '#2c2420'],
      [1, '#120d0b'],
    ]),
    radial('lava-hot', [134, 220], 64, [
      [0, '#fff2b0'],
      [0.3, '#ffc24a'],
      [0.65, '#f2711c'],
      [1, '#a82a0a'],
    ]),
    radial('lava-glow', [128, 200], 110, [
      [0, '#ff7a24', 0.45],
      [0.5, '#e0501a', 0.15],
      [1, '#e0501a', 0],
    ]),
    relief('r-crust', { frequency: 0.07, octaves: 4, roughness: 0.9, dome: 4, depth: 14, gloss: 0.25, sharpness: 10, strength: 1, seed: 101 }),
    relief('r-lobe', { frequency: '0.03 0.12', octaves: 3, roughness: 0.6, dome: 6, depth: 10, gloss: 0.6, sharpness: 14, strength: 0.6, seed: 102 }),
    `<filter id="lava-crack-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter>`,
    `<clipPath id="flow-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  // Плиты корки разделены трещинами-ломаными
  const random = rng(7);
  const cracks: Pt[][] = [
    [[44, 186], [70, 184], [92, 172], [118, 168], [140, 176], [170, 172], [200, 180], [220, 196]],
    [[92, 172], [96, 190], [88, 212]],
    [[140, 176], [136, 194], [124, 200]],
    [[170, 172], [178, 190], [174, 208]],
    [[70, 184], [64, 202], [72, 216]],
    [[118, 168], [124, 156]],
    [[200, 180], [206, 166]],
  ];
  const crackPaths = cracks
    .map((c, i) => {
      const jag = c.map(([x, y]) => [x + (random() - 0.5) * 3, y + (random() - 0.5) * 3] as Pt);
      const wide = ink(jag, { width: 4 - Math.min(i, 3) * 0.6, taper: [0.15, 0.15], shade: 0, pressure: 0.5, seed: 10 + i, raw: true });
      const core = ink(jag, { width: 1.6 - Math.min(i, 3) * 0.2, taper: [0.15, 0.15], shade: 0, pressure: 0.5, seed: 20 + i, raw: true });
      return `<path d="${wide}" fill="#ff6a1a" filter="url(#lava-crack-glow)"/><path d="${wide}" fill="#d2400e"/><path d="${core}" fill="#ffd36a"/>`;
    })
    .join('');
  const lobe = smooth(LOBE);
  // Канатная кожа потока: дуги, выгнутые по течению
  const wrinkles = [0, 1, 2, 3, 4]
    .map((i) => {
      const x = 92 + i * 20;
      return inkPath(ink([[x, 214 + (i % 2) * 3], [x + 8, 222], [x + 4, 232]], { width: 1.6, taper: [0.3, 0.3], shade: 0, seed: 40 + i }), '#8a2408', 0.6);
    })
    .join('');
  return svg(`${defs(extra)}
  <ellipse cx="128" cy="196" rx="120" ry="70" fill="url(#lava-glow)" filter="url(#glow)"/>
  ${groundShadow(128, 222, 86, 7, 0.7)}
  <path d="${d}" fill="url(#crust)" filter="url(#r-crust)"/>
  <g clip-path="url(#flow-clip)">
    ${crackPaths}
    <path d="${d}" fill="#000" filter="url(#core-dark)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  </g>
  ${inkPath(ink(FLOW, { width: 2, closed: true, shade: 1, seed: 3 }), INK, 0.9)}
  <!-- Прорыв: жидкий язык лавы -->
  <ellipse cx="134" cy="234" rx="70" ry="8" fill="#ff8a30" fill-opacity="0.55" filter="url(#blur-4)"/>
  <path d="${lobe}" fill="url(#lava-hot)" filter="url(#r-lobe)"/>
  ${wrinkles}
  ${inkPath(ink(LOBE, { width: 1.4, closed: true, shade: 1, seed: 4 }), '#5a1406', 0.8)}
  <!-- Дым и искры над прорывом -->
  <path d="${ink([[150, 150], [158, 126], [148, 104], [160, 80]], { width: 18, taper: [0.2, 0.9], shade: 0, pressure: 0.4, seed: 50 })}" fill="#4a423e" fill-opacity="0.35" filter="url(#blur-4)"/>
  ${speck(118, 140, 1.2, '#ff9a3c', '#ffe0a0', 0.4)}
  ${speck(170, 132, 0.9, '#ff9a3c', '#ffe0a0', 0.4)}
  `);
}

export const lava: ElementArt = { id: 'lava', render };
