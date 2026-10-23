import { HIGHLIGHT, INK, defs, ellipse, groundShadow, ink, inkPath, linear, relief, smooth, svg, type ElementArt, type Pt } from '../lib';
import { drawLeaf } from '../kit';

/**
 * Растение: молодой росток в старом глиняном горшке.
 * Живой контраст с остальной серией: сочная зелень, полупрозрачные листья
 * (на свету светлеют, в тени уходят в синеву), разворачивающийся верхний лист,
 * на нижнем листе — капля росы. Горшок — пористая терракота со сколом и налётом соли.
 */

function render(): string {
  const pot: Pt[] = [[78, 160], [178, 160], [170, 172], [162, 224], [94, 224], [86, 172]];
  const extra = [
    linear('terracotta', [70, 160], [190, 226], [
      [0, '#c47a4e'],
      [0.5, '#93502e'],
      [1, '#4e2814'],
    ]),
    linear('stem', [0, 60], [0, 160], [
      [0, '#9ab85a'],
      [1, '#4e6a2c'],
    ]),
    relief('r-pot', { frequency: 0.3, octaves: 2, roughness: 0.45, dome: 8, depth: 6, gloss: 0.08, strength: 1, seed: 131 }),
  ].join('');
  const stem: Pt[] = [[128, 166], [126, 140], [132, 112], [128, 84], [132, 62]];
  return svg(`${defs(extra)}
  ${groundShadow(130, 222, 58, 7)}
  <!-- Горшок -->
  <path d="${smooth(pot)}" fill="url(#terracotta)" filter="url(#r-pot)"/>
  <path d="${smooth(pot)}" fill="#000" filter="url(#core-cold)"/>
  <path d="${smooth(pot)}" fill="#000" filter="url(#rim-warm)"/>
  <!-- Налёт соли у донышка -->
  <path d="${smooth([[98, 214], [128, 210], [160, 214], [160, 222], [96, 222]])}" fill="#d8ccb4" fill-opacity="0.35" filter="url(#wash)"/>
  <ellipse cx="128" cy="162" rx="50" ry="7" fill="#2a1a10"/>
  <ellipse cx="128" cy="161" rx="44" ry="5" fill="#3e2a1a"/>
  ${inkPath(ink(ellipse([128, 161], 51, 8, 24), { width: 1.8, closed: true, shade: 0.4, seed: 3 }), INK, 0.85)}
  ${inkPath(ink([[170, 172], [162, 224], [94, 224], [86, 172]], { width: 2, taper: [0.1, 0.1], shade: 1, seed: 4 }), INK, 0.85)}
  ${inkPath(ink([[86, 172], [170, 172]], { width: 1, taper: [0.2, 0.2], shade: 0, seed: 5 }), INK, 0.5)}
  <!-- Скол на краю -->
  <path d="M160 160 L168 159 L165 166 Z" fill="#d89a6a"/>
  <!-- Стебель и листья -->
  ${inkPath(ink(stem, { width: 4.2, taper: [0, 0.6], shade: 0.5, seed: 6 }), '#5d7a34')}
  ${inkPath(ink(stem, { width: 1.2, taper: [0, 0.6], shade: 0, seed: 7 }), '#b8d07a', 0.7)}
  ${drawLeaf([127, 146], [78, 132], 26, -6, '#5f8a36', 11)}
  ${drawLeaf([129, 128], [184, 112], 28, 6, '#4f7a30', 12)}
  ${drawLeaf([130, 100], [92, 78], 22, -5, '#6e9a40', 13)}
  ${drawLeaf([130, 84], [166, 58], 18, 4, '#7aa848', 14)}
  <!-- Верхний лист ещё свёрнут -->
  <path d="${smooth([[132, 64], [138, 46], [134, 34], [128, 46]])}" fill="#9cc25a"/>
  ${inkPath(ink([[132, 64], [138, 46], [134, 34], [128, 46], [132, 64]], { width: 1, shade: 1, seed: 15 }), INK, 0.7)}
  <!-- Капля росы на листе -->
  <circle cx="96" cy="134" r="3.2" fill="#c8e0c0" fill-opacity="0.6"/>
  <circle cx="95" cy="133" r="1" fill="${HIGHLIGHT}"/>
  ${inkPath(ink(ellipse([96, 134], 3.2, 3.2, 12), { width: 0.6, closed: true, shade: 1, seed: 16 }), '#2a4a2a', 0.7)}
  `);
}

export const plant: ElementArt = { id: 'plant', render };
