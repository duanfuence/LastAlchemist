import { HIGHLIGHT, INK, defs, ellipse, groundShadow, ink, inkPath, linear, polyD, relief, rng, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';
import { mound } from '../kit';

/**
 * Соль: горка крупной соли в тёмной деревянной плошке и несколько кубических кристаллов рядом.
 * Соль — полупрозрачная и кубическая: у каждого кристалла светлая верхняя грань,
 * сероватые боковые, на рёбрах искрится свеча. Контраст белого с тёмным деревом.
 */

/** Кубический кристалл в изометрии. */
function cube(x: number, y: number, s: number, tilt: number, seed: number): string {
  const a = (tilt * Math.PI) / 180;
  const rot = ([px, py]: Pt): Pt => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)];
  const corners = (list: Pt[]): Pt[] => list.map(rot);
  const top = corners([[-s, -s * 0.5], [0, -s], [s, -s * 0.5], [0, 0]]);
  const left = corners([[-s, -s * 0.5], [0, 0], [0, s], [-s, s * 0.5]]);
  const right = corners([[0, 0], [s, -s * 0.5], [s, s * 0.5], [0, s]]);
  return `<path d="${polyD(left)}" fill="#d9d8d0" fill-opacity="0.92"/>
    <path d="${polyD(right)}" fill="#9aa2a4" fill-opacity="0.92"/>
    <path d="${polyD(top)}" fill="#fbf9f2"/>
    <path d="M${top[0]![0]} ${top[0]![1]}L${top[1]![0]} ${top[1]![1]}L${top[2]![0]} ${top[2]![1]}" fill="none" stroke="${HIGHLIGHT}" stroke-width="0.8"/>
    ${inkPath(ink([top[0]!, top[1]!, top[2]!, right[2]!, left[2]!, left[3]!, top[0]!], { width: 0.9, shade: 1, seed, raw: true }), '#3a4244', 0.8)}
    ${inkPath(ink([top[3]!, left[2]!], { width: 0.6, shade: 0, seed: seed + 1, raw: true }), '#3a4244', 0.5)}`;
}

function render(): string {
  const dish: Pt[] = [...ellipse([128, 176], 82, 18, 18, Math.PI, 0), [204, 192], [184, 214], [128, 222], [72, 214], [52, 192]];
  const heap = mound(128, 182, 140, 52, 3);
  const extra = [
    linear('walnut', [60, 170], [190, 224], [
      [0, '#6a4228'],
      [0.5, '#3e2414'],
      [1, '#1a0e06'],
    ]),
    linear('salt-heap', [80, 130], [180, 186], [
      [0, '#fffdf6'],
      [0.6, '#e4e0d4'],
      [1, '#a4a6a0'],
    ]),
    relief('r-walnut', { frequency: '0.012 0.2', octaves: 3, roughness: 0.7, dome: 6, depth: 10, gloss: 0.5, sharpness: 14, strength: 1, seed: 151 }),
    relief('r-salt', { frequency: 0.35, octaves: 2, roughness: 0.8, dome: 10, depth: 8, gloss: 0.6, sharpness: 30, strength: 0.6, seed: 152 }),
  ].join('');
  const random = rng(9);
  const surfaceCubes = Array.from({ length: 9 }, (_, i) => {
    const t = 0.15 + (i / 8) * 0.7;
    const x = 58 + t * 140 + (random() - 0.5) * 8;
    const y = 182 - 52 * Math.pow(Math.sin(Math.PI * t), 1.4) + 6 + random() * 10;
    return cube(x, y, 3.2 + random() * 2.4, (random() - 0.5) * 30, 20 + i);
  }).join('');
  return svg(`${defs(extra)}
  <g transform="translate(128 224) scale(1.1) translate(-128 -224)">
  ${groundShadow(130, 218, 84, 8)}
  <path d="${smooth(dish)}" fill="url(#walnut)" filter="url(#r-walnut)"/>
  <path d="${smooth(dish)}" fill="#000" filter="url(#rim-warm)"/>
  <ellipse cx="128" cy="176" rx="74" ry="13" fill="#140a04"/>
  <path d="${smooth(heap)}" fill="url(#salt-heap)" filter="url(#r-salt)"/>
  <path d="${smooth(heap)}" fill="#000" filter="url(#core-cold)"/>
  ${surfaceCubes}
  ${stipple({
    count: 50,
    bounds: [70, 130, 190, 180],
    density: () => 0.4,
    radius: (_x, _y, r) => 0.4 + r() * 0.6,
    color: HIGHLIGHT,
    seed: 11,
  })}
  ${inkPath(ink(ellipse([128, 176], 82, 18, 26, Math.PI * 0.02, Math.PI * 0.98), { width: 1.6, taper: [0.1, 0.1], shade: 0, seed: 3 }), '#c98a5a', 0.6)}
  ${inkPath(ink([[204, 192], [184, 214], [128, 222], [72, 214], [52, 192]], { width: 1.8, taper: [0.1, 0.1], shade: 1, seed: 4 }), INK, 0.85)}
  ${inkPath(ink(ellipse([128, 176], 82, 18, 26, Math.PI, Math.PI * 2), { width: 1.4, taper: [0.1, 0.1], shade: 0, seed: 5 }), INK, 0.7)}
  ${cube(44, 224, 9, -8, 40)}
  ${cube(214, 222, 7, 12, 41)}
  ${cube(196, 232, 4.5, 4, 42)}
  </g>
  `);
}

export const salt: ElementArt = { id: 'salt', render };
