import {
  CANDLE,
  HIGHLIGHT,
  INK,
  candleReflection,
  coldShade,
  defs,
  ellipse,
  hatch,
  ink,
  inkPath,
  linear,
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

function render(): string {
  const dropD = smooth(DROP);
  const extra = [
    radial('water-body', [146, 168], 120, [
      [0, '#86b9ab'],
      [0.35, '#2f6f73'],
      [0.7, '#123e4a'],
      [1, '#081f2b'],
    ], [156, 182]),
    radial('caustic', [158, 186], 46, [
      [0, '#d6eadc', 0.9],
      [0.45, '#8dbdae', 0.6],
      [1, '#6fa79a', 0],
    ]),
    radial('pool', [128, 226], 94, [
      [0, '#2c5658', 0.92],
      [0.55, '#4f7570', 0.55],
      [1, '#7e9a90', 0],
    ]),
    linear('refraction', [0, 168], [0, 196], [
      [0, '#d9c9a3', 0],
      [0.35, '#d9c9a3', 0.55],
      [0.6, '#c4b38c', 0.45],
      [0.75, '#0f3440', 0.5],
      [1, '#0f3440', 0],
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
    return `<path d="${smooth(shape)}" fill="#24585c" filter="url(#wash)"/>` +
      `<circle cx="${x + r * 0.25}" cy="${y + r * 0.3}" r="${r * 0.4}" fill="#9cc6b8"/>` +
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
  <ellipse cx="148" cy="226" rx="42" ry="7" fill="#081a20" fill-opacity="0.6" filter="url(#blur-2)"/>
  <ellipse cx="114" cy="221" rx="20" ry="2.6" fill="${CANDLE}" fill-opacity="0.55" filter="url(#blur-2)"/>
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
    <!-- Холодный отсвет справа: в воде отражается сумрак комнаты -->
    <path d="${smooth([[186, 128], [190, 158], [181, 182], [160, 198], [134, 204], [158, 192], [174, 176], [181, 152]])}" fill="#b8d4cc" fill-opacity="0.4" filter="url(#wash-soft)"/>
    ${coldShade('water-shade', 'drop-clip', [96, 70], [190, 205], 0.4)}
  </g>
  <!-- В капле отражается пламя свечи -->
  ${candleReflection(97, 128, 9)}
  <path d="${smooth([[123, 48], [127, 42], [128, 56], [124, 78], [120, 82], [120, 66]])}" fill="${HIGHLIGHT}" fill-opacity="0.65"/>
  <circle cx="171" cy="176" r="2" fill="#d8ebe4" fill-opacity="0.85"/>
  ${inkPath(ink(shadowSide, { width: 4.6, taper: [0.25, 0.2], shade: 0.5, seed: 3 }))}
  ${inkPath(ink(litSide, { width: 2, taper: [0.35, 0.4], shade: 0, seed: 4 }))}
  ${inkPath(ink(litTop, { width: 1.8, taper: [0.3, 0.2], shade: 0, seed: 5 }))}
  `);
}

export const water: ElementArt = { id: 'water', render };
