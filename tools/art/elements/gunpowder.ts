import { HIGHLIGHT, INK, defs, ellipse, groundShadow, ink, inkPath, linear, relief, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';
import { mound } from '../kit';

/**
 * Порох: маленький дубовый бочонок с железными обручами и фитилём из пробки,
 * перед ним — рассыпанная горка чёрного зернистого пороха. Дерево клёпок в рельефе,
 * обручи блестят, порох матово-чёрный с редкими искорками графитового блеска.
 */

function render(): string {
  const keg: Pt[] = [[86, 92], [170, 92], [184, 122], [188, 152], [182, 184], [170, 206], [86, 206], [74, 184], [68, 152], [72, 122]];
  const d = smooth(keg);
  const extra = [
    linear('oak', [70, 100], [190, 210], [
      [0, '#a2703e'],
      [0.5, '#6a4222'],
      [1, '#2e1a0c'],
    ]),
    linear('hoop', [70, 0], [190, 0], [
      [0, '#8a8e8e'],
      [0.3, '#4a4e50'],
      [1, '#1a1c1e'],
    ]),
    relief('r-oak', { frequency: '0.25 0.012', octaves: 3, roughness: 0.8, dome: 6, depth: 10, gloss: 0.2, sharpness: 10, strength: 1, seed: 181 }),
    `<clipPath id="keg-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  // Клёпки: вертикальные швы, выгнутые по бочке
  const staves = [-3, -2, -1, 0, 1, 2, 3]
    .map((k, i) => {
      const x = 128 + k * 17;
      const bulge = k * 3.4;
      return inkPath(ink([[x - k * 0.6, 94], [x + bulge, 150], [x - k * 0.6, 204]], { width: 1, taper: [0.05, 0.05], shade: 0, seed: 10 + i }), '#24140a', 0.7);
    })
    .join('');
  const hoop = (y: number, rx: number, seed: number): string =>
    `<path d="${ink(ellipse([128, y], rx, 7, 20, 0.05, Math.PI - 0.05), { width: 6, taper: [0.02, 0.02], shade: 0, seed })}" fill="url(#hoop)"/>` +
    inkPath(ink(ellipse([128, y - 2], rx, 7, 16, 0.4, Math.PI * 0.55), { width: 1, taper: [0.3, 0.3], shade: 0, seed: seed + 1 }), HIGHLIGHT, 0.6);
  const powder = mound(156, 232, 120, 22, 4);
  return svg(`${defs(extra)}
  ${groundShadow(130, 208, 66, 6)}
  <path d="${d}" fill="url(#oak)" filter="url(#r-oak)"/>
  <g clip-path="url(#keg-clip)">${staves}<path d="${d}" fill="#000" filter="url(#core-cold)"/><path d="${d}" fill="#000" filter="url(#rim-warm)"/></g>
  ${hoop(112, 52, 21)}${hoop(190, 50, 23)}${hoop(152, 60, 25)}
  <!-- Крышка, пробка и фитиль -->
  <ellipse cx="128" cy="92" rx="42" ry="9" fill="#8a5a30"/>
  <ellipse cx="128" cy="92" rx="36" ry="6.5" fill="#5e3a1c"/>
  ${inkPath(ink(ellipse([128, 92], 42, 9, 24), { width: 1.6, closed: true, shade: 0.4, seed: 30 }), INK, 0.85)}
  <ellipse cx="140" cy="90" rx="6" ry="2.6" fill="#c49a62"/>
  ${inkPath(ink([[140, 89], [146, 74], [138, 60], [148, 46]], { width: 2, taper: [0, 0.3], shade: 0, pressure: 0.3, seed: 31 }), '#cdb48a')}
  ${inkPath(ink([[140, 89], [146, 74], [138, 60], [148, 46]], { width: 0.6, taper: [0, 0.3], shade: 0, seed: 32 }), INK, 0.6)}
  ${inkPath(ink(keg, { width: 2, closed: true, shade: 1.1, seed: 33 }), INK, 0.9)}
  <!-- Алхимический знак на боку: треугольник огня в круге -->
  <g fill="none" stroke="#e8d2a8" stroke-opacity="0.55" stroke-width="1.6"><circle cx="112" cy="152" r="10"/><path d="M112 145 L118.5 157 H105.5 Z"/></g>
  <!-- Рассыпанный порох -->
  <path d="${smooth(powder)}" fill="#1a1716" filter="url(#wash)"/>
  ${stipple({
    count: 360,
    bounds: [92, 206, 220, 238],
    density: (x, y) => Math.max(0, 1 - Math.hypot((x - 156) / 64, (y - 226) / 14)),
    radius: (_x, _y, r) => 0.5 + r() * 0.9,
    color: (_x, _y, r) => (r() > 0.85 ? '#9a9aa0' : r() > 0.4 ? '#2a2826' : '#0a0908'),
    seed: 41,
  })}
  `);
}

export const gunpowder: ElementArt = { id: 'gunpowder', render };
