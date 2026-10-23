import { HIGHLIGHT, INK, defs, ink, inkPath, svg, type ElementArt, type Pt } from '../lib';
import { drawLeaf } from '../kit';

/**
 * Ветер: сильные порывы, свитые в тугие завитки, несут сорванные осенние листья.
 * Отличие от воздуха — сила: ленты плотнее и шире, у завитков тёмная изнанка,
 * листья кувыркаются и летят по ходу потока. Сухой стебелёк внизу согнут ветром.
 */

/** Лента порыва: светлая лицевая сторона, холодная изнанка на завитке. */
function gust(points: Pt[], width: number, seed: number): string {
  const d = ink(points, { width, taper: [0.6, 0.25], shade: 0, pressure: 0.3, seed });
  return `<path d="${d}" fill="#5a6c74" fill-opacity="0.55" transform="translate(2 3)" filter="url(#blur-1)"/>
    <path d="${d}" fill="#dfe4e2"/>
    <path d="${ink(points, { width: width * 0.35, taper: [0.6, 0.3], shade: 0, seed: seed + 1 })}" fill="${HIGHLIGHT}" transform="translate(-1 -1)"/>
    ${inkPath(ink(points.slice(Math.floor(points.length / 2)), { width: 1.1, taper: [0.3, 0.4], shade: 0, seed: seed + 2 }), '#2c3a40', 0.55)}`;
}

function render(): string {
  const leaves = [
    drawLeaf([164, 66], [200, 44], 22, 4, '#c0602a', 61),
    drawLeaf([192, 132], [228, 146], 20, -4, '#d89a3a', 62),
    drawLeaf([96, 192], [66, 176], 18, 3, '#8a3a1e', 63),
  ].join('');
  return svg(`${defs()}
  ${gust([[16, 120], [70, 104], [126, 112], [168, 98], [184, 78], [172, 64], [156, 72], [160, 86]], 9, 11)}
  ${gust([[24, 168], [86, 152], [146, 160], [196, 148], [220, 128], [212, 112], [196, 116], [198, 130]], 11, 21)}
  ${gust([[44, 214], [104, 202], [150, 210], [190, 198], [206, 182], [196, 172], [186, 178]], 7, 31)}
  ${leaves}
  <!-- Сухой стебелёк гнётся по ветру -->
  ${inkPath(ink([[38, 236], [42, 220], [52, 206], [66, 198]], { width: 1.8, taper: [0, 0.8], shade: 0, seed: 70 }), '#6e5a3a')}
  ${inkPath(ink([[46, 236], [52, 224], [64, 216]], { width: 1.4, taper: [0, 0.8], shade: 0, seed: 71 }), '#8a7448')}
  ${inkPath(ink([[36, 238], [56, 238]], { width: 1, taper: [0.3, 0.3], shade: 0, seed: 72 }), INK, 0.4)}
  `);
}

export const wind: ElementArt = { id: 'wind', render };
