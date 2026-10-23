import { HIGHLIGHT, INK, candleReflection, defs, ellipse, groundShadow, ink, inkPath, linear, relief, rng, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';

/**
 * Пар: медная чаша с горячей водой, над ней поднимаются и закручиваются клубы пара.
 * Пар — светлая полупрозрачная материя без контура: тёплый край к свече, холодная
 * сторона в тени, кверху редеет и растворяется. Чаша — старая медь с патиной.
 */

/** Струя пара: широкий мазок вдоль S-образной кривой, кверху тоньше и прозрачнее. */
function wisp(points: Pt[], width: number, seed: number, opacity: number): string {
  const body = ink(points, { width, taper: [0.25, 0.85], shade: 0, pressure: 0.35, seed });
  return `<path d="${body}" fill="#8c9592" fill-opacity="${(opacity * 0.55).toFixed(2)}" transform="translate(3 3)" filter="url(#steam-soft)"/>
    <path d="${body}" fill="#f6efe2" fill-opacity="${opacity}" filter="url(#steam-soft)"/>
    <path d="${ink(points, { width: width * 0.35, taper: [0.3, 0.9], shade: 0, seed: seed + 1 })}" fill="${HIGHLIGHT}" fill-opacity="${(opacity * 0.7).toFixed(2)}" transform="translate(-2 -1)" filter="url(#blur-2)"/>`;
}

function render(): string {
  const extra = [
    linear('copper', [70, 170], [190, 226], [
      [0, '#d08a56'],
      [0.35, '#9a5a32'],
      [0.7, '#5a321c'],
      [1, '#2a160c'],
    ]),
    linear('steam-water', [70, 170], [190, 186], [
      [0, '#3b5c5c'],
      [1, '#132628'],
    ]),
    relief('r-copper', { frequency: 0.07, octaves: 3, roughness: 0.35, dome: 7, depth: 12, gloss: 1, sharpness: 18, strength: 0.9, seed: 91 }),
    `<filter id="steam-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="13" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="14" xChannelSelector="R" yChannelSelector="G" result="wavy"/>
      <feGaussianBlur in="wavy" stdDeviation="3.2"/>
    </filter>`,
  ].join('');
  const bowl: Pt[] = [...ellipse([128, 176], 64, 13, 16, Math.PI, 0), [188, 196], [172, 216], [148, 224], [108, 224], [84, 216], [68, 196]];
  const rimFront = ellipse([128, 176], 64, 13, 18, 0.05, Math.PI - 0.05);
  const random = rng(5);
  const patina = stipple({
    count: 80,
    bounds: [70, 186, 186, 222],
    density: (x) => (x > 140 ? 0.7 : 0.2),
    radius: () => 0.6 + random() * 1.6,
    color: (_x, _y, r) => (r() > 0.5 ? '#5f8a76' : '#7aa28c'),
    seed: 7,
    opacity: 0.55,
  });
  return svg(`${defs(extra)}
  ${groundShadow(130, 222, 70, 7)}
  <!-- Чаша: медь, вода внутри, патина -->
  <path d="${smooth(bowl)}" fill="url(#copper)" filter="url(#r-copper)"/>
  <clipPath id="bowl-clip"><path d="${smooth(bowl)}"/></clipPath>
  <g clip-path="url(#bowl-clip)">${patina}<path d="${smooth(bowl)}" fill="#000" filter="url(#core-cold)"/></g>
  <ellipse cx="128" cy="176" rx="58" ry="10" fill="url(#steam-water)"/>
  <ellipse cx="108" cy="174" rx="12" ry="2" fill="#e9dcc0" fill-opacity="0.5" filter="url(#blur-1)"/>
  ${inkPath(ink(ellipse([128, 176], 64, 13, 24), { width: 2.2, closed: true, shade: 0.5, seed: 3 }), '#3a1e10', 0.9)}
  ${inkPath(ink(rimFront, { width: 1.4, taper: [0.2, 0.2], shade: 0, seed: 4 }), '#f0b47e', 0.8)}
  ${inkPath(ink([[188, 196], [172, 216], [148, 224], [108, 224], [84, 216], [68, 196]], { width: 2, taper: [0.1, 0.1], shade: 0.8, seed: 5 }), INK, 0.85)}
  ${candleReflection(84, 196, 4, 0.8)}
  <!-- Пар поднимается и закручивается -->
  ${wisp([[104, 172], [96, 146], [110, 120], [100, 92], [112, 66]], 30, 11, 0.7)}
  ${wisp([[140, 172], [150, 144], [136, 116], [150, 86], [140, 54], [152, 30]], 34, 21, 0.75)}
  ${wisp([[122, 170], [126, 150], [118, 132], [126, 112]], 22, 31, 0.6)}
  ${wisp([[164, 170], [172, 150], [166, 132]], 16, 41, 0.5)}
  `);
}

export const steam: ElementArt = { id: 'steam', render };
