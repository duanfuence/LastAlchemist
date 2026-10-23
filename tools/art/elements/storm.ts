import { HIGHLIGHT, defs, ink, svg, type ElementArt, type Pt } from '../lib';
import { CLOUD_SOFT, cloud, cloudDefs, rainStreaks } from '../kit';

/**
 * Гроза: низкая чёрная туча и ветвистая молния. Молния — единственный источник света:
 * она подсвечивает брюхо тучи холодным белым, вокруг разряда — сияние, на земле вспышка.
 * Свечение есть только у разряда, туча остаётся тёмной и тяжёлой.
 */

const PUFFS: readonly (readonly [number, number, number])[] = [
  [62, 88, 28],
  [196, 84, 30],
  [98, 64, 34],
  [146, 54, 38],
  [120, 36, 24],
  [178, 62, 26],
  [86, 98, 28],
  [134, 96, 34],
  [176, 100, 26],
  [40, 104, 18],
  [218, 102, 18],
];

const BOLT: Pt[] = [[136, 112], [124, 140], [138, 146], [116, 180], [128, 184], [104, 226]];
const BRANCH: Pt[] = [[124, 140], [108, 154], [100, 170]];

function render(): string {
  const extra = [
    CLOUD_SOFT,
    cloudDefs('s', { light: '#8e8c88', body: '#4b4f54', dark: '#15191d' }),
    `<filter id="bolt-glow" x="-100%" y="-30%" width="300%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>`,
  ].join('');
  const bolt = ink(BOLT, { width: 7, taper: [0.05, 0.6], shade: 0, pressure: 0.2, seed: 3, raw: true });
  const branch = ink(BRANCH, { width: 3.4, taper: [0.05, 0.8], shade: 0, seed: 4, raw: true });
  return svg(`${defs(extra)}
  <!-- Вспышка на земле в месте удара -->
  <ellipse cx="106" cy="228" rx="60" ry="9" fill="#cdd8ff" fill-opacity="0.35" filter="url(#blur-4)"/>
  <ellipse cx="130" cy="230" rx="94" ry="9" fill="#0e1114" fill-opacity="0.35" filter="url(#blur-8)"/>
  ${rainStreaks([30, 110, 226, 220], 40, -0.22, 7, '#3a4950', 0.65)}
  <path d="${bolt}${branch}" fill="#bccbff" filter="url(#bolt-glow)"/>
  <path d="${bolt}${branch}" fill="#9fb2ff" filter="url(#blur-2)"/>
  <path d="${bolt}${branch}" fill="#e9eeff"/>
  <path d="${ink(BOLT, { width: 2.6, taper: [0.05, 0.7], shade: 0, seed: 5, raw: true })}" fill="${HIGHLIGHT}"/>
  ${cloud('s', PUFFS, 118)}
  <!-- Разряд подсвечивает тучу изнутри -->
  <ellipse cx="134" cy="106" rx="34" ry="12" fill="#c6d2ff" fill-opacity="0.45" filter="url(#blur-8)"/>
  `);
}

export const storm: ElementArt = { id: 'storm', render };
