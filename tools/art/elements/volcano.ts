import { INK, defs, groundShadow, ink, inkPath, linear, radial, relief, rng, smooth, speck, svg, type ElementArt, type Pt } from '../lib';
import { CLOUD_SOFT, cloud, cloudDefs } from '../kit';

/**
 * Вулкан: тёмный конус застывшей породы, в жерле светится расплав, по склонам
 * стекают огненные ручьи, из кратера поднимается тяжёлый столб пепла, снизу
 * подсвеченный оранжевым. Порода — шершавая, слоистая; свечение — только у лавы.
 */

const CONE: Pt[] = [[18, 226], [56, 186], [90, 140], [110, 104], [124, 98], [142, 98], [156, 106], [176, 142], [210, 184], [240, 226]];

function render(): string {
  const d = smooth(CONE);
  const extra = [
    CLOUD_SOFT,
    cloudDefs('ash', { light: '#8a7a6c', body: '#4e4642', dark: '#1e1a18' }),
    linear('cone', [60, 100], [200, 226], [
      [0, '#6e5c4c'],
      [0.45, '#3e322a'],
      [1, '#15100c'],
    ]),
    radial('crater-glow', [133, 100], 40, [
      [0, '#ffd27a', 0.9],
      [0.4, '#ff7a24', 0.5],
      [1, '#ff7a24', 0],
    ]),
    relief('r-cone', { frequency: '0.04 0.09', octaves: 4, roughness: 0.85, dome: 14, depth: 18, gloss: 0.1, strength: 1, seed: 141 }),
    `<filter id="flow-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>`,
    `<clipPath id="cone-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  const flows: Pt[][] = [
    [[120, 102], [112, 130], [118, 150], [104, 178], [96, 206]],
    [[146, 104], [154, 136], [148, 160], [164, 190]],
    [[132, 104], [134, 124]],
  ];
  const flowPaths = flows
    .map((f, i) => {
      const wide = ink(f, { width: 6 - i, taper: [0.05, 0.7], shade: 0, pressure: 0.4, seed: 10 + i });
      return `<path d="${wide}" fill="#ff6a1a" filter="url(#flow-glow)"/><path d="${wide}" fill="#e2541a"/><path d="${ink(f, { width: 2.2 - i * 0.3, taper: [0.05, 0.75], shade: 0, seed: 20 + i })}" fill="#ffd06a"/>`;
    })
    .join('');
  // Слои породы — тёмные полосы поперёк склона
  const random = rng(4);
  const strata = [130, 156, 182, 206]
    .map((y, i) => inkPath(ink([[70 - i * 12, y + 10], [120, y + (random() - 0.5) * 6], [190 + i * 12, y + 12]], { width: 1.4, taper: [0.3, 0.3], shade: 0, pressure: 0.5, seed: 30 + i }), '#0e0a08', 0.4))
    .join('');
  const plume: (readonly [number, number, number])[] = [
    [120, 76, 18], [146, 70, 20], [132, 52, 22], [112, 40, 18], [150, 34, 22], [128, 22, 18], [170, 50, 16],
  ];
  return svg(`${defs(extra)}
  ${groundShadow(130, 226, 92, 7)}
  <path d="${d}" fill="url(#cone)" filter="url(#r-cone)"/>
  <g clip-path="url(#cone-clip)">
    ${strata}
    ${flowPaths}
    <path d="${d}" fill="#000" filter="url(#core-dark)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
  </g>
  ${inkPath(ink(CONE, { width: 2, taper: [0.1, 0.1], shade: 1, seed: 3 }), INK, 0.9)}
  <!-- Жерло -->
  <ellipse cx="133" cy="100" rx="40" ry="26" fill="url(#crater-glow)"/>
  <ellipse cx="133" cy="101" rx="17" ry="4" fill="#ffc25a"/>
  <ellipse cx="133" cy="101" rx="9" ry="2" fill="#fff0b0"/>
  <!-- Столб пепла, подсвеченный снизу -->
  ${cloud('ash', plume, 92)}
  <ellipse cx="134" cy="84" rx="26" ry="9" fill="#ff8a30" fill-opacity="0.4" filter="url(#blur-4)"/>
  ${speck(104, 70, 1.4, '#ff9a3c', '#ffe0a0')}
  ${speck(166, 82, 1.1, '#ff9a3c', '#ffe0a0')}
  ${speck(92, 92, 0.9, '#ff9a3c', '#ffe0a0', 0.4)}
  `);
}

export const volcano: ElementArt = { id: 'volcano', render };
