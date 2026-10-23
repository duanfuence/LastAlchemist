import { INK, defs, groundShadow, ink, inkPath, linear, relief, rng, smooth, speck, svg, type ElementArt, type Pt } from '../lib';
import { mound } from '../kit';

/**
 * Пепел: горка серого пепла, из неё торчит обугленная веточка, внутри ещё тлеет уголёк.
 * Материал — лёгкий порошок: мелкий бархатный рельеф без блеска, верх почти белый.
 * Над горкой медленно поднимаются хлопья. Свечение только у одного уголька.
 */

const HEAP = mound(128, 222, 176, 76, 8);

function render(): string {
  const d = smooth(HEAP);
  const extra = [
    linear('ash-body', [80, 146], [180, 226], [
      [0, '#d6d0c6'],
      [0.45, '#8e8880'],
      [1, '#3e3a36'],
    ]),
    relief('r-ash', { frequency: 0.28, octaves: 3, roughness: 0.7, dome: 14, depth: 10, gloss: 0, strength: 0.9, seed: 71 }),
    relief('r-char', { frequency: '0.05 0.4', octaves: 3, roughness: 1, dome: 2, depth: 8, gloss: 0.3, sharpness: 8, seed: 72 }),
    `<clipPath id="ash-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  const twig: Pt[] = [[150, 186], [166, 150], [178, 128], [186, 116]];
  const twigD = ink(twig, { width: 7, taper: [0, 0.4], shade: 0.6, seed: 5 });
  const random = rng(9);
  const flakes = Array.from({ length: 9 }, (_, i) => {
    const x = 92 + random() * 80;
    const y = 40 + random() * 90;
    const s = 1.6 + random() * 2.2;
    const a = random() * 180;
    return `<path d="M${x - s} ${y} L${x} ${y - s * 0.6} L${x + s} ${y + s * 0.2} L${x + s * 0.2} ${y + s * 0.7} Z" transform="rotate(${a.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i % 3 ? '#a8a29a' : '#5a5650'}" fill-opacity="${(0.5 + random() * 0.4).toFixed(2)}"/>`;
  }).join('');
  return svg(`${defs(extra)}
  ${groundShadow(130, 222, 86, 8)}
  <!-- Обугленная веточка: кора трескается, на верхней стороне лежит пепел -->
  <path d="${twigD}" fill="#2a1d16" filter="url(#r-char)"/>
  <path d="${ink(twig, { width: 2, taper: [0, 0.5], shade: 0, seed: 6 })}" fill="#a49c92" fill-opacity="0.7" transform="translate(-2 -1)"/>
  ${inkPath(ink(twig, { width: 1, taper: [0, 0.4], shade: 0, seed: 7 }), INK, 0.6)}
  <path d="${d}" fill="url(#ash-body)" filter="url(#r-ash)"/>
  <g clip-path="url(#ash-clip)">
    <!-- Уголёк тлеет под тонким слоем пепла -->
    <ellipse cx="112" cy="200" rx="18" ry="7" fill="#e8601e" fill-opacity="0.4" filter="url(#blur-4)"/>
    <path d="${smooth([[102, 201], [108, 196], [118, 196], [123, 201], [113, 205]])}" fill="#2e160c" fill-opacity="0.85"/>
    <path d="${ink([[105, 200], [109, 198.5], [113, 200], [118, 198.5]], { width: 1.2, taper: [0.3, 0.3], shade: 0, pressure: 0.6, seed: 8 })}" fill="#ff8a32"/>
    <path d="${ink([[108, 202.5], [114, 202], [119, 203]], { width: 0.8, taper: [0.3, 0.3], shade: 0, seed: 10 })}" fill="#ffb24a" fill-opacity="0.8"/>
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  </g>
  ${inkPath(ink(HEAP.slice(0, 12), { width: 1.6, taper: [0.3, 0.3], shade: 1, seed: 4 }), INK, 0.7)}
  ${speck(114, 186, 0.9, '#ff9a3c', '#ffd08a', 0.5)}
  ${flakes}
  `);
}

export const ash: ElementArt = { id: 'ash', render };
