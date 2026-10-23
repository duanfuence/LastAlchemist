import {
  CANDLE,
  HIGHLIGHT,
  candleReflection,
  defs,
  edge,
  ellipse,
  ink,
  inkPath,
  linear,
  radial,
  rimDark,
  smooth,
  svg,
  type ElementArt,
  type Pt,
} from '../lib';

/**
 * Вода: тяжёлая прозрачная капля над тёмной лужицей.
 * Вода не имеет своего цвета — её видно по тому, что она делает со светом:
 * - край капли темнее середины (по краю свет отражается, а не проходит);
 * - свет свечи проходит насквозь и собирается на противоположной, нижней правой стороне (каустика);
 * - на гладкой поверхности сверху слева отражается пламя, снизу — перевёрнутая светлая страница;
 * - в лужице отражаются капля и свеча, по воде расходятся кольца.
 * Контур — тонкая глубокая бирюза, а не чёрная тушь: вода не должна выглядеть нарисованной.
 */

const TEAL_INK = '#082228';

const DROP: Pt[] = [
  [128, 18],
  [137, 40],
  [154, 68],
  [174, 98],
  [188, 128],
  [192, 157],
  [183, 182],
  [162, 199],
  [128, 207],
  [94, 199],
  [73, 182],
  [64, 157],
  [68, 128],
  [82, 98],
  [102, 68],
  [119, 40],
];

/** Кольца на воде: светлая кромка к свету и тёмная впадина за ней. */
function ripples(): string {
  return [
    { rx: 46, ry: 7.5, w: 1.8 },
    { rx: 70, ry: 11.5, w: 1.4 },
    { rx: 90, ry: 15, w: 1 },
  ]
    .map(({ rx, ry, w }, i) => {
      const front = ellipse([128, 224], rx, ry, 18, 0.15, Math.PI - 0.15);
      const back = ellipse([128, 224], rx, ry, 14, Math.PI + 0.45, Math.PI * 2 - 0.45);
      const crest = ellipse([128, 223], rx, ry, 18, 0.25, Math.PI - 0.6);
      return (
        inkPath(ink(front, { width: w * 1.4, taper: [0.35, 0.35], shade: 0, seed: 20 + i }), TEAL_INK, 0.7 - i * 0.15) +
        inkPath(ink(crest, { width: w, taper: [0.4, 0.4], shade: 0, seed: 30 + i }), '#b9d6cc', 0.55 - i * 0.12) +
        inkPath(ink(back, { width: w * 0.8, taper: [0.4, 0.4], shade: 0, seed: 40 + i }), TEAL_INK, 0.4 - i * 0.1)
      );
    })
    .join('');
}

/** Маленькая капля-брызга: та же оптика в миниатюре. */
function splash([x, y]: Pt, r: number, seed: number): string {
  const shape: Pt[] = [[x, y - r * 1.8], [x + r, y - r * 0.2], [x + r * 0.75, y + r * 0.8], [x, y + r], [x - r * 0.75, y + r * 0.8], [x - r, y - r * 0.2]];
  const d = smooth(shape);
  return `<ellipse cx="${x + r * 0.6}" cy="${y + r * 1.9}" rx="${r * 1.3}" ry="${r * 0.35}" fill="#06161b" fill-opacity="0.45" filter="url(#blur-1)"/>
    <path d="${d}" fill="#2a6468"/>
    <path d="${d}" fill="#000" filter="url(#water-fresnel-s)"/>
    <ellipse cx="${x + r * 0.25}" cy="${y + r * 0.45}" rx="${r * 0.45}" ry="${r * 0.3}" fill="#bfe0d2" fill-opacity="0.8"/>
    <circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.22}" fill="${HIGHLIGHT}"/>
    ${inkPath(ink(shape, { width: 0.9, closed: true, shade: 0.9, seed }), TEAL_INK, 0.9)}`;
}

function render(): string {
  const dropD = smooth(DROP);
  const extra = [
    radial('water-body', [150, 172], 128, [
      [0, '#7fb5a6'],
      [0.3, '#3b7c7c'],
      [0.62, '#164854'],
      [1, '#06202b'],
    ], [160, 186]),
    radial('caustic', [160, 184], 44, [
      [0, '#f2f4dc', 0.95],
      [0.35, '#bfe1cf', 0.7],
      [0.7, '#7fb7a4', 0.25],
      [1, '#7fb7a4', 0],
    ]),
    radial('pool', [128, 225], 98, [
      [0, '#123c44', 0.95],
      [0.5, '#1d4b50', 0.75],
      [0.8, '#4c6c66', 0.35],
      [1, '#7e9a90', 0],
    ]),
    linear('refraction', [0, 160], [0, 200], [
      [0, '#e8d8b2', 0],
      [0.3, '#e8d8b2', 0.5],
      [0.55, '#cdb88f', 0.42],
      [0.72, '#0d2f38', 0.45],
      [1, '#0d2f38', 0],
    ]),
    linear('reflection-fade', [0, 228], [0, 250], [
      [0, '#fff', 0.55],
      [1, '#fff', 0],
    ]),
    `<mask id="reflection-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="url(#reflection-fade)"/></mask>`,
    `<clipPath id="drop-clip"><path d="${dropD}"/></clipPath>`,
    `<clipPath id="pool-clip"><ellipse cx="128" cy="225" rx="92" ry="16"/></clipPath>`,
    rimDark('water-fresnel', 9, '#041820', 0.85),
    rimDark('water-fresnel-s', 1.6, '#041820', 0.7),
    edge('water-rim', { dx: -3, dy: -4, blur: 2, color: '#cfe6dc', opacity: 0.55 }),
    // Гладкая поверхность: объём и блик градиентами (рельефный фильтр дал бы зерно)
    radial('water-sheen', [104, 96], 70, [
      [0, HIGHLIGHT, 0.32],
      [0.4, '#cfe4da', 0.12],
      [1, '#cfe4da', 0],
    ]),
  ].join('');

  const reflection = `<g clip-path="url(#pool-clip)" mask="url(#reflection-mask)">
      <g transform="translate(0 452) scale(1 -1)" opacity="0.7" filter="url(#blur-1)">
        <path d="${dropD}" fill="url(#water-body)" transform="translate(128 226) scale(1 0.35) translate(-128 -226)"/>
      </g>
      <ellipse cx="102" cy="232" rx="5" ry="1.6" fill="${CANDLE}" fill-opacity="0.75" filter="url(#blur-1)"/>
    </g>`;

  // Контур: справа и снизу (в тени) плотнее, слева и сверху почти растворяется в свете
  const shadowSide: Pt[] = [[134, 32], [142, 48], [157, 73], [176, 101], [189, 130], [192, 157], [183, 182], [162, 199], [128, 207], [96, 200], [78, 187]];
  const litSide: Pt[] = [[70, 176], [64, 156], [68, 129], [80, 103]];

  return svg(`${defs(extra)}
  <!-- Лужица, отражение и кольца -->
  <ellipse cx="128" cy="225" rx="98" ry="19" fill="url(#pool)"/>
  ${reflection}
  <ellipse cx="150" cy="226" rx="40" ry="6" fill="#030d10" fill-opacity="0.55" filter="url(#blur-2)"/>
  <!-- Каустика: свет, прошедший сквозь каплю, падает на воду за ней -->
  <ellipse cx="162" cy="225" rx="18" ry="3.2" fill="#d9ecd8" fill-opacity="0.45" filter="url(#blur-2)"/>
  ${ripples()}
  ${splash([46, 207], 5.2, 50)}
  ${splash([212, 199], 4.2, 51)}
  ${splash([190, 214], 2.6, 52)}

  <!-- Тело капли -->
  <g clip-path="url(#drop-clip)">
    <path d="${dropD}" fill="url(#water-body)"/>
    <ellipse cx="104" cy="100" rx="44" ry="62" transform="rotate(24 104 100)" fill="url(#water-sheen)"/>
    <!-- Сквозь воду видна тень левого края -->
    <path d="${smooth([[60, 122], [86, 84], [118, 34], [124, 70], [106, 112], [98, 150], [110, 190], [70, 188]])}" fill="#0c303a" fill-opacity="0.45" filter="url(#blur-4)"/>
    <!-- Отражение комнаты: тёмная линия горизонта -->
    <path d="${smooth([[56, 150], [96, 142], [140, 148], [200, 138], [200, 151], [140, 160], [98, 155], [56, 165]])}" fill="#09262e" fill-opacity="0.4" filter="url(#blur-2)"/>
    <!-- Преломление: перевёрнутая страница под каплей -->
    <rect x="60" y="160" width="140" height="40" fill="url(#refraction)" filter="url(#blur-2)"/>
    <ellipse cx="160" cy="184" rx="32" ry="17" transform="rotate(-28 160 184)" fill="url(#caustic)"/>
    <path d="${dropD}" fill="#000" filter="url(#water-fresnel)"/>
    <!-- Холодный отсвет по правому краю -->
    <path d="${dropD}" fill="#000" filter="url(#water-rim)"/>
  </g>
  <!-- Пламя свечи на поверхности и узкие блики -->
  ${candleReflection(96, 128, 8.5)}
  <path d="${smooth([[122, 50], [126, 42], [127, 56], [123, 78], [119, 83], [119, 66]])}" fill="${HIGHLIGHT}" fill-opacity="0.7"/>
  <path d="${smooth([[84, 160], [86, 170], [94, 182], [90, 182], [83, 172]])}" fill="${HIGHLIGHT}" fill-opacity="0.28"/>
  <circle cx="172" cy="178" r="1.8" fill="#eef7ef" fill-opacity="0.9"/>
  ${inkPath(ink(shadowSide, { width: 2.4, taper: [0.3, 0.25], shade: 0.6, seed: 3 }), TEAL_INK, 0.95)}
  ${inkPath(ink(litSide, { width: 1.1, taper: [0.4, 0.4], shade: 0, seed: 4 }), TEAL_INK, 0.7)}
  `);
}

export const water: ElementArt = { id: 'water', render };
