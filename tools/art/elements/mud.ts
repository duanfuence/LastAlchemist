import { HIGHLIGHT, INK, candleReflection, defs, ellipse, groundShadow, ink, inkPath, linear, relief, smooth, svg, type ElementArt, type Pt } from '../lib';

/**
 * Грязь: густая мокрая лужа-оплыв с пузырями. Отличие от земли — блеск:
 * влажная поверхность отражает пламя свечи, края расплываются потёками,
 * на поверхности вздуваются и лопаются пузыри. Вокруг — брызги.
 */

const BLOB: Pt[] = [
  [40, 210], [52, 190], [76, 176], [98, 160], [124, 152], [150, 158], [176, 170], [200, 182], [218, 200], [214, 216],
  [196, 224], [170, 222], [150, 230], [120, 228], [92, 230], [64, 224],
];

function render(): string {
  const d = smooth(BLOB);
  const extra = [
    linear('mud-body', [60, 160], [190, 232], [
      [0, '#8e6a44'],
      [0.4, '#5e4228'],
      [1, '#24180c'],
    ]),
    relief('r-mud', { frequency: 0.035, octaves: 3, roughness: 0.5, dome: 9, depth: 16, gloss: 1.1, sharpness: 22, strength: 0.9, seed: 81 }),
    relief('r-bubble', { frequency: 0.05, octaves: 1, roughness: 0.05, dome: 3, depth: 8, gloss: 1.4, sharpness: 30, strength: 0.8, seed: 82 }),
    `<clipPath id="mud-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  const bubble = (x: number, y: number, r: number): string => {
    const dome = ellipse([x, y], r, r * 0.7, 16, Math.PI, Math.PI * 2);
    const shape: Pt[] = [...dome, [x + r, y + 1], [x - r, y + 1]];
    return `<path d="${smooth(shape)}" fill="#5e4430" filter="url(#r-bubble)"/>` +
      `<ellipse cx="${x - r * 0.35}" cy="${y - r * 0.4}" rx="${r * 0.22}" ry="${r * 0.12}" fill="${HIGHLIGHT}" fill-opacity="0.85"/>` +
      inkPath(ink(dome, { width: 0.9, taper: [0.2, 0.2], shade: 1, seed: Math.round(x) }), INK, 0.7);
  };
  // Лопнувший пузырь: кольцо-кратер
  const burst = inkPath(ink(ellipse([92, 196], 9, 3, 14), { width: 1.3, closed: true, shade: 1, seed: 5 }), INK, 0.7) +
    `<ellipse cx="92" cy="196.5" rx="7" ry="2" fill="#1a110a"/>` +
    inkPath(ink(ellipse([92, 195], 9, 3, 10, Math.PI + 0.3, Math.PI * 2 - 0.3), { width: 0.8, taper: [0.3, 0.3], shade: 0, seed: 6 }), HIGHLIGHT, 0.5);
  const drops = [[30, 222, 4], [226, 214, 3.4], [214, 232, 2.2], [46, 234, 2]]
    .map(([x, y, r], i) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r! * 0.55}" fill="#3c2a1a"/><ellipse cx="${x! - r! * 0.3}" cy="${y! - r! * 0.2}" rx="${r! * 0.3}" ry="${r! * 0.14}" fill="${HIGHLIGHT}" fill-opacity="0.7"/>${inkPath(ink(ellipse([x!, y!], r!, r! * 0.55, 10), { width: 0.6, closed: true, shade: 1, seed: 90 + i }), INK, 0.6)}`)
    .join('');
  return svg(`${defs(extra)}
  <g transform="translate(128 228) scale(1.12) translate(-128 -228)">
  ${groundShadow(128, 222, 92, 8)}
  <!-- Мокрая плёнка воды вокруг оплыва -->
  <path d="${d}" fill="#3a3a2c" fill-opacity="0.3" transform="translate(128 214) scale(1.07 1.2) translate(-128 -214)" filter="url(#blur-2)"/>
  <path d="${d}" fill="url(#mud-body)" filter="url(#r-mud)"/>
  <g clip-path="url(#mud-clip)">
    <!-- Разводы: светлая глина и тёмная вода -->
    <path d="${smooth([[70, 196], [110, 182], [150, 186], [180, 200], [150, 196], [110, 194]])}" fill="#b08a5e" fill-opacity="0.4" filter="url(#blur-2)"/>
    <!-- Стекающие потёки у края -->
    ${[60, 96, 150, 190].map((x, i) => `<path d="${ink([[x, 212 + (i % 2) * 4], [x + 2, 222], [x + 1, 228]], { width: 4, taper: [0.1, 0.6], shade: 0, seed: 70 + i })}" fill="#3a2816" fill-opacity="0.7"/>`).join('')}
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
  </g>
  ${burst}
  ${bubble(140, 176, 14)}
  ${bubble(170, 188, 8)}
  ${bubble(116, 192, 6)}
  ${bubble(196, 202, 4)}
  ${candleReflection(98, 170, 5, 0.9)}
  ${inkPath(ink(BLOB, { width: 2, closed: true, shade: 1.1, seed: 3 }), INK, 0.9)}
  ${drops}
  </g>
  `);
}

export const mud: ElementArt = { id: 'mud', render };
