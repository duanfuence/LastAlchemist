import { defs, groundShadow, ink, inkPath, linear, relief, smooth, stipple, svg, INK, type ElementArt } from '../lib';
import { FACET_SHADE, crystal, lump } from '../kit';

/**
 * Сера: друза ярко-жёлтых кристаллов на тёмной вулканической породе.
 * Кристаллы стеклянно блестят и слегка просвечивают, грани разной яркости;
 * у основания порода присыпана жёлтым серным налётом.
 */

const BASE = lump([128, 196], 86, 30, 61, 0.6, 0.14, 16);

function render(): string {
  const d = smooth(BASE);
  const palette = { light: '#fff27e', mid: '#e3c12c', dark: '#8a6a0e', edge: '#fffbd6' };
  const extra = [
    FACET_SHADE,
    linear('basalt', [60, 170], [190, 226], [
      [0, '#5a5048'],
      [0.5, '#332c28'],
      [1, '#141110'],
    ]),
    relief('r-basalt', { frequency: 0.08, octaves: 4, roughness: 0.9, dome: 8, depth: 14, gloss: 0.15, strength: 1, seed: 161 }),
  ].join('');
  const crystals = [
    crystal([112, 190], 100, 26, -14, palette, 1),
    crystal([150, 188], 112, 30, 10, palette, 2),
    crystal([132, 194], 132, 32, -2, palette, 3),
    crystal([86, 198], 64, 20, -32, palette, 4),
    crystal([176, 196], 70, 22, 30, palette, 5),
    crystal([102, 204], 40, 14, -50, palette, 6),
    crystal([162, 206], 46, 16, 46, palette, 7),
  ].join('');
  return svg(`${defs(extra)}
  ${groundShadow(130, 222, 86, 8)}
  <path d="${d}" fill="url(#basalt)" filter="url(#r-basalt)"/>
  <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  ${crystals}
  <!-- Серный налёт на породе -->
  ${stipple({
    count: 220,
    bounds: [50, 186, 210, 222],
    density: (x, y) => Math.max(0, 1 - Math.hypot((x - 130) / 76, (y - 200) / 14)),
    radius: (_x, _y, r) => 0.4 + r() * 1,
    color: (_x, _y, r) => (r() > 0.5 ? '#e8cc3a' : '#bfa024'),
    seed: 17,
  })}
  ${inkPath(ink(BASE.slice(2, 12), { width: 1.8, taper: [0.2, 0.2], shade: 1, seed: 9 }), INK, 0.85)}
  `);
}

export const sulfur: ElementArt = { id: 'sulfur', render };
