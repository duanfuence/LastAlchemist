import {
  HIGHLIGHT,
  INK,
  defs,
  ellipse,
  hatch,
  ink,
  inkPath,
  linear,
  polyD,
  radial,
  smooth,
  svg,
  type ElementArt,
  type Pt,
} from '../lib';

/**
 * Вода: крупная прозрачная капля над лужицей.
 * Задачи: жидкость, прозрачность, отражения. Свет сверху слева, поэтому внутри капли
 * светится противоположный (нижний правый) край — каустика, сверху слева отражается окно,
 * а в нижней части видна перевёрнутая преломлённая полоса светлой страницы.
 */

const DROP: Pt[] = [
  [128, 20],
  [137, 42],
  [154, 70],
  [174, 100],
  [188, 130],
  [191, 158],
  [182, 183],
  [161, 200],
  [128, 208],
  [95, 200],
  [74, 183],
  [65, 158],
  [68, 130],
  [82, 100],
  [102, 70],
  [119, 42],
];

/** Отражение оконного переплёта: четыре стекла, изогнутые по форме капли. */
function windowReflection(): string {
  const panes: [Pt[], number][] = [
    [[[87, 119], [97, 112], [99, 126], [90, 132]], 0.95],
    [[[100, 110], [110, 106], [111, 120], [102, 124]], 0.95],
    [[[91, 136], [100, 130], [102, 144], [94, 150]], 0.7],
    [[[104, 128], [112, 124], [113, 138], [106, 142]], 0.65],
  ];
  const glass = panes.map(([pane, opacity]) => `<path d="${polyD(pane)}" fill="${HIGHLIGHT}" fill-opacity="${opacity}"/>`).join('');
  // Мягкий ореол вокруг отражения — свет «тонет» в воде
  return `<path d="${smooth([[84, 114], [114, 100], [122, 140], [94, 158]])}" fill="${HIGHLIGHT}" fill-opacity="0.35" filter="url(#blur-4)"/>${glass}`;
}

function render(): string {
  const dropD = smooth(DROP);
  const extra = [
    radial('water-body', [146, 168], 120, [
      [0, '#a6dccd'],
      [0.35, '#4f9fa4'],
      [0.7, '#226b80'],
      [1, '#134360'],
    ], [156, 182]),
    radial('caustic', [158, 186], 46, [
      [0, '#f2fbef'],
      [0.45, '#bfe6d6', 0.8],
      [1, '#9fd3c6', 0],
    ]),
    radial('pool', [128, 226], 94, [
      [0, '#5c9c9b', 0.9],
      [0.55, '#86b8b0', 0.6],
      [1, '#a9cbbf', 0],
    ]),
    linear('refraction', [0, 168], [0, 196], [
      [0, '#f3ecd6', 0],
      [0.35, '#f3ecd6', 0.7],
      [0.6, '#e6dcc0', 0.55],
      [0.75, '#1d4f5a', 0.45],
      [1, '#1d4f5a', 0],
    ]),
    `<clipPath id="drop-clip"><path d="${dropD}"/></clipPath>`,
    `<mask id="drop-dark" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
       <rect width="256" height="256" fill="url(#mask-grad)"/></mask>`,
    linear('mask-grad', [70, 50], [160, 150], [
      [0, '#fff'],
      [0.55, '#fff', 0.3],
      [1, '#000'],
    ]),
  ].join('');

  // Рябь: тонкие прерывистые дуги, передние плотнее задних
  const ripples = [
    { rx: 50, ry: 8.5, width: 2.2 },
    { rx: 76, ry: 13, width: 1.7 },
  ]
    .map(({ rx, ry, width }, i) => {
      const frontLeft = ellipse([128, 224], rx, ry, 10, 0.2, Math.PI * 0.42);
      const frontRight = ellipse([128, 224], rx, ry, 10, Math.PI * 0.5, Math.PI - 0.2);
      const back = ellipse([128, 224], rx, ry, 12, Math.PI + 0.5, Math.PI * 2 - 0.5);
      return (
        inkPath(ink(frontLeft, { width, taper: [0.4, 0.3], seed: 20 + i })) +
        inkPath(ink(frontRight, { width, taper: [0.3, 0.4], seed: 24 + i })) +
        inkPath(ink(back, { width: width * 0.6, taper: [0.4, 0.4], seed: 30 + i }), INK, 0.55)
      );
    })
    .join('');

  // Брызги: две маленькие капли рядом с лужей
  const splash = ([x, y]: Pt, r: number, seed: number): string => {
    const shape: Pt[] = [[x, y - r * 1.7], [x + r, y - r * 0.2], [x + r * 0.7, y + r * 0.8], [x, y + r], [x - r * 0.7, y + r * 0.8], [x - r, y - r * 0.2]];
    return `<path d="${smooth(shape)}" fill="#3f8a8c" filter="url(#wash)"/>` +
      `<circle cx="${x + r * 0.25}" cy="${y + r * 0.3}" r="${r * 0.4}" fill="#cdeee2"/>` +
      `<circle cx="${x - r * 0.35}" cy="${y - r * 0.2}" r="${r * 0.25}" fill="${HIGHLIGHT}"/>` +
      inkPath(ink(shape, { width: 1.5, closed: true, seed }));
  };

  // Контур: на теневой стороне (справа и снизу) тяжёлый, на освещённой — тонкий и прерывистый
  const shadowSide: Pt[] = [[132, 30], [140, 46], [156, 72], [175, 101], [189, 131], [191, 158], [182, 183], [161, 200], [128, 208], [95, 200], [76, 186]];
  const litSide: Pt[] = [[71, 176], [65, 156], [68, 130], [80, 104]];
  const litTop: Pt[] = [[90, 89], [103, 69], [119, 42], [127, 22]];

  return svg(`${defs(extra)}
  <!-- Лужица и тень капли на воде -->
  <ellipse cx="128" cy="225" rx="94" ry="17" fill="url(#pool)" filter="url(#wash)"/>
  <ellipse cx="148" cy="226" rx="42" ry="7" fill="#17414c" fill-opacity="0.5" filter="url(#blur-2)"/>
  <ellipse cx="118" cy="221" rx="22" ry="3" fill="${HIGHLIGHT}" fill-opacity="0.6" filter="url(#blur-2)"/>
  ${ripples}
  ${splash([50, 207], 5.5, 40)}
  ${splash([208, 199], 4.5, 41)}

  <!-- Тело капли: основная заливка и лессировки -->
  <g clip-path="url(#drop-clip)">
    <path d="${dropD}" fill="url(#water-body)" filter="url(#wash)"/>
    <!-- Тёмная лессировка вдоль освещённого края: сквозь воду видна тень -->
    <path d="${smooth([[60, 120], [86, 82], [118, 34], [124, 70], [104, 112], [96, 150], [108, 190], [70, 186]])}" fill="#163e4a" fill-opacity="0.55" filter="url(#wash)"/>
    <!-- Отражение комнаты: тёмная дуга горизонта -->
    <path d="${smooth([[56, 150], [96, 141], [140, 147], [200, 137], [200, 151], [140, 161], [98, 155], [56, 166]])}" fill="#0f3440" fill-opacity="0.32" filter="url(#wash-soft)"/>
    ${hatch({ clip: 'drop-clip', mask: 'drop-dark', angle: 58, spacing: 3.6, width: 0.9, bounds: [56, 16, 200, 212], seed: 7, opacity: 0.5 })}
    <!-- Преломление: перевёрнутая светлая полоса страницы и лужи -->
    <rect x="60" y="164" width="140" height="36" fill="url(#refraction)" filter="url(#wash-soft)"/>
    <!-- Каустика: свет, собранный каплей на противоположной стороне -->
    <ellipse cx="160" cy="184" rx="30" ry="16" transform="rotate(-28 160 184)" fill="url(#caustic)"/>
    <path d="${smooth([[186, 128], [190, 158], [181, 182], [160, 198], [134, 204], [158, 192], [174, 176], [181, 152]])}" fill="${HIGHLIGHT}" fill-opacity="0.55" filter="url(#wash-soft)"/>
  </g>
  ${windowReflection()}
  <path d="${smooth([[123, 48], [127, 42], [128, 56], [124, 78], [120, 82], [120, 66]])}" fill="${HIGHLIGHT}" fill-opacity="0.85"/>
  <circle cx="171" cy="176" r="2.2" fill="${HIGHLIGHT}"/>
  ${inkPath(ink(shadowSide, { width: 4.6, taper: [0.25, 0.2], shade: 0.5, seed: 3 }))}
  ${inkPath(ink(litSide, { width: 2, taper: [0.35, 0.4], shade: 0, seed: 4 }))}
  ${inkPath(ink(litTop, { width: 1.8, taper: [0.3, 0.2], shade: 0, seed: 5 }))}
  `);
}

export const water: ElementArt = { id: 'water', render };
