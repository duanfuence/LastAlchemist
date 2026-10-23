import { HIGHLIGHT, INK, defs, groundShadow, ink, inkPath, linear, relief, smooth, stipple, svg, type ElementArt, type Pt } from '../lib';
import { mound } from '../kit';

/**
 * Песок: золотистая горка, на вершину сверху сыплется тонкая струйка.
 * Материал — сухие мелкие зёрна: мелкий матовый рельеф, по склону — рябь от ветра
 * (светлый гребень и тень за ним), у подножия отдельные песчинки.
 */

const HILL = mound(128, 222, 196, 74, 5);

function render(): string {
  const d = smooth(HILL);
  const extra = [
    linear('sand-body', [70, 140], [190, 226], [
      [0, '#e8cc8e'],
      [0.45, '#bf9a5e'],
      [1, '#6e5232'],
    ]),
    relief('r-sand', { frequency: 0.9, octaves: 2, roughness: 0.5, dome: 18, depth: 7, gloss: 0.08, strength: 0.9, seed: 61 }),
    linear('stream', [0, 20], [0, 140], [
      [0, '#c9a868', 0],
      [0.25, '#c9a868', 0.85],
      [1, '#b08a50', 0.95],
    ]),
    `<clipPath id="sand-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  // Рябь от ветра: короткие волнистые гребни на подветренном склоне
  const ripples = [
    [150, 176, 22], [162, 188, 30], [146, 198, 34], [174, 204, 26], [120, 208, 30], [188, 214, 20], [96, 196, 18],
  ]
    .map(([x, y, w], i) => {
      const crest: Pt[] = [[x! - w!, y! + 3], [x! - w! * 0.3, y! - 1.5], [x! + w! * 0.4, y! + 0.5], [x! + w!, y! + 4]];
      return inkPath(ink(crest, { width: 1.1, taper: [0.45, 0.45], shade: 0, seed: 70 + i }), HIGHLIGHT, 0.45) +
        inkPath(ink(crest.map(([cx, cy]) => [cx + 1, cy + 2] as Pt), { width: 1.3, taper: [0.45, 0.45], shade: 0, seed: 80 + i }), '#5a3e22', 0.4);
    })
    .join('');
  return svg(`${defs(extra)}
  ${groundShadow(128, 222, 86, 8)}
  <path d="${d}" fill="url(#sand-body)" filter="url(#r-sand)"/>
  <g clip-path="url(#sand-clip)">
    ${ripples}
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  </g>
  ${inkPath(ink(HILL.slice(0, 12), { width: 1.8, taper: [0.3, 0.3], shade: 0.9, seed: 9 }), '#3a2814', 0.85)}
  <!-- Струйка песка: плотная в середине, по краям отдельные зёрна -->
  <path d="${smooth([[125.5, 40], [129.5, 40], [131, 150], [124, 150]], true)}" fill="url(#stream)" filter="url(#blur-1)"/>
  ${stipple({
    count: 260,
    bounds: [114, 36, 142, 152],
    density: (x, y) => Math.max(0, 1 - Math.abs(x - 127.5) / (3 + (y - 36) / 18)) * (y > 46 ? 1 : 0.4),
    radius: (_x, _y, r) => 0.35 + r() * 0.55,
    color: (_x, _y, r) => (r() > 0.6 ? '#f2dca8' : '#9c7a44'),
    seed: 91,
  })}
  <!-- Брызги песка у вершины и песчинки у подножия -->
  ${stipple({
    count: 140,
    bounds: [96, 140, 160, 160],
    density: (x, y) => Math.max(0, 1 - Math.hypot((x - 128) / 30, (y - 152) / 9)),
    radius: (_x, _y, r) => 0.4 + r() * 0.6,
    color: (_x, _y, r) => (r() > 0.5 ? '#f2dca8' : '#a88450'),
    seed: 92,
  })}
  ${stipple({
    count: 70,
    bounds: [24, 220, 232, 236],
    density: (x) => (Math.abs(x - 128) > 92 ? 0.8 : 0.1),
    radius: (_x, _y, r) => 0.4 + r() * 0.7,
    color: '#9c7a44',
    seed: 93,
  })}
  ${inkPath(ink([[42, 224], [128, 230], [214, 224]], { width: 1.2, taper: [0.3, 0.3], shade: 0, seed: 12 }), INK, 0.35)}
  `);
}

export const sand: ElementArt = { id: 'sand', render };
