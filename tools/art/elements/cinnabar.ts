import { INK, defs, groundShadow, ink, inkPath, linear, relief, smooth, stipple, svg, type ElementArt } from '../lib';
import { FACET_SHADE, crystal, lump } from '../kit';

/**
 * Киноварь: тёмно-красные ромбоэдрические кристаллы, вросшие в светлый кварц.
 * Отличие от серы — материал и контраст: мелкие густо-алые кристаллы с алмазным блеском
 * на бледной молочной породе, рядом растёртая в порошок киноварь (алая краска).
 */

const ROCK = lump([124, 182], 80, 42, 71, 0.65, 0.16, 16);

function render(): string {
  const d = smooth(ROCK);
  const palette = { light: '#e65a48', mid: '#a82418', dark: '#4e0a06', edge: '#ffc2b0' };
  const extra = [
    FACET_SHADE,
    linear('quartz', [60, 140], [190, 226], [
      [0, '#efe8dc'],
      [0.5, '#c4bcae'],
      [1, '#6e6862'],
    ]),
    relief('r-quartz', { frequency: 0.06, octaves: 3, roughness: 0.6, dome: 14, depth: 14, gloss: 0.5, sharpness: 16, strength: 1, seed: 171 }),
  ].join('');
  const crystals = [
    crystal([96, 160], 40, 16, -24, palette, 11),
    crystal([118, 152], 52, 20, -6, palette, 12),
    crystal([142, 156], 44, 18, 16, palette, 13),
    crystal([164, 168], 30, 14, 34, palette, 14),
    crystal([80, 178], 26, 12, -46, palette, 15),
    crystal([130, 172], 26, 12, 4, palette, 16),
  ].join('');
  return svg(`${defs(extra)}
  ${groundShadow(128, 218, 84, 8)}
  <path d="${d}" fill="url(#quartz)" filter="url(#r-quartz)"/>
  <path d="${d}" fill="#000" filter="url(#core-cold)"/>
  <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  <!-- Красные прожилки в кварце -->
  ${inkPath(ink([[70, 196], [100, 190], [128, 198], [160, 192], [188, 200]], { width: 2.4, taper: [0.3, 0.3], shade: 0, pressure: 0.6, seed: 3 }), '#9a2a1c', 0.6)}
  ${crystals}
  ${inkPath(ink(ROCK, { width: 1.8, closed: true, shade: 1.1, seed: 9 }), INK, 0.85)}
  <!-- Растёртый порошок -->
  <path d="${smooth([[176, 226], [196, 218], [222, 222], [226, 230], [196, 234]])}" fill="#c2301e" filter="url(#wash)"/>
  ${stipple({
    count: 60,
    bounds: [168, 214, 234, 236],
    density: (x, y) => Math.max(0, 1 - Math.hypot((x - 200) / 32, (y - 226) / 10)),
    radius: (_x, _y, r) => 0.4 + r() * 0.8,
    color: (_x, _y, r) => (r() > 0.5 ? '#e85a40' : '#7a160c'),
    seed: 19,
  })}
  `);
}

export const cinnabar: ElementArt = { id: 'cinnabar', render };
