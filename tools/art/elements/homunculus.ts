import {
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
  polyD,
  radial,
  rng,
  smooth,
  svg,
  type ElementArt,
  type Pt,
} from '../lib';

/**
 * Гомункул — тайное открытие. Древний запечатанный сосуд, пролежавший века в подземной лаборатории:
 * мутная бутылочно-зелёная жидкость с осадком, в ней свернулось бледное существо — свет едва
 * исходит от него самого. Один глаз чуть приоткрыт. Стекло в разводах и с трещиной, сургуч
 * потрескался, на горле — потускневший золотой поясок и бумажный ярлык на бечёвке.
 * Золото здесь — единственный в серии знак редкости, и оно старое.
 */

const GOLD_DARK = '#5e4416';
const SKIN_INK = '#3e2a22';

/** Колба: круглое тело и длинное горло. */
const FLASK: Pt[] = [
  [117, 36], [117, 70], [116, 92], [96, 102], [74, 120], [62, 146], [64, 176], [78, 202], [100, 218], [128, 223],
  [156, 218], [178, 202], [192, 176], [194, 146], [182, 120], [160, 102], [140, 92], [139, 70], [139, 36],
];
/** Жидкость: от линии мениска вниз. */
const LIQUID: Pt[] = [
  [70, 128], [96, 122], [128, 120], [160, 122], [186, 128], [193, 150], [191, 176], [177, 201], [156, 216], [128, 220],
  [100, 216], [79, 201], [65, 176], [63, 150],
];

/** Существо, свернувшееся калачиком: крупная голова, изогнутая спина, поджатые ноги, рука у подбородка. */
function creature(): string {
  // Профиль обращён вниз, к коленям: лоб, переносица, нос, подбородок
  const head: Pt[] = [[109, 141], [115, 136], [122, 137], [127, 143], [127, 150], [123, 156], [117, 158], [112, 157], [109.5, 154], [107.5, 151.5], [106, 148.5], [107.5, 146], [107.5, 143.5]];
  const body: Pt[] = [[121, 158], [127, 155], [135, 156], [141, 162], [144, 171], [142, 180], [136, 186], [128, 188], [122, 184], [124, 176], [121, 168], [119, 162]];
  const leg: Pt[] = [[125, 175], [118, 173], [112, 176], [110, 181], [115, 186], [124, 188], [131, 187], [130, 181]];
  const arm: Pt[] = [[125, 162], [119, 164], [114, 163.5], [110.5, 161], [111.5, 158.5], [115, 159.5], [121, 158]];
  const shapes = [body, leg, head, arm];
  const fills = shapes.map((shape) => `<path d="${smooth(shape)}" fill="url(#skin)"/>`).join('');
  const line = (shape: Pt[], width: number, seed: number, opacity: number): string =>
    inkPath(ink(shape, { width, closed: true, shade: 1.2, pressure: 0.3, seed }), SKIN_INK, opacity);
  // Прожилки под прозрачной кожей
  const veins: Pt[][] = [
    [[114, 140], [118, 143], [121, 142], [124, 145]],
    [[131, 160], [136, 166], [138, 174]],
    [[126, 170], [130, 176], [134, 178]],
  ];
  const veinPaths = veins.map((v, i) => inkPath(ink(v, { width: 0.7, taper: [0.4, 0.4], shade: 0, pressure: 0.4, seed: 90 + i }), '#6e3d47', 0.4)).join('');
  // Пуповина уходит вниз, в осадок
  const cord = ink([[128, 186], [124, 194], [130, 202], [125, 210], [129, 218]], { width: 2.4, taper: [0.1, 0.5], shade: 0.4, pressure: 0.3, seed: 95 });
  return `<ellipse cx="126" cy="166" rx="34" ry="32" fill="url(#aura)" filter="url(#blur-4)"/>
    <path d="${cord}" fill="#a99a8a" fill-opacity="0.75"/>
    <g filter="url(#soft-edge)" opacity="0.92">${fills}</g>
    ${coldShade('creature-shade', 'creature-clip', [112, 150], [146, 190], 0.5)}
    ${veinPaths}
    ${line(body, 1.1, 61, 0.55)}${line(leg, 0.9, 62, 0.5)}${line(head, 1.1, 63, 0.6)}${line(arm, 0.8, 64, 0.45)}
    <!-- Глаз чуть приоткрыт: тёмная щель и крошечный отблеск -->
    <ellipse cx="112.6" cy="146.8" rx="3.3" ry="2.3" fill="#8f7a66" fill-opacity="0.45" filter="url(#soft-edge)"/>
    <path d="M110.2 146.4 Q112.8 145.2 115.3 146.6 Q112.8 148.4 110.2 146.4 Z" fill="#140d0b"/>
    <circle cx="113.6" cy="146.3" r="0.55" fill="#f3efe0"/>
    ${inkPath(ink([[110, 146], [112.8, 144.9], [115.6, 146.3]], { width: 0.8, taper: [0.3, 0.4], shade: 0, seed: 65 }), SKIN_INK, 0.85)}
    ${inkPath(ink([[120, 146], [122, 148], [121, 151], [119, 151]], { width: 0.8, taper: [0.3, 0.4], shade: 0, seed: 67 }), SKIN_INK, 0.45)}
    ${inkPath(ink([[133, 157], [140, 164], [143, 174]], { width: 0.9, taper: [0.5, 0.5], shade: 0, seed: 66 }), SKIN_INK, 0.35)}
    <path d="${smooth([[110, 145], [114, 141], [119, 141], [114, 144]])}" fill="${HIGHLIGHT}" fill-opacity="0.55"/>`;
}

/** Взвесь в жидкости и осадок на дне. */
function sediment(): string {
  const random = rng(31);
  const motes = Array.from({ length: 70 }, () => {
    const x = 70 + random() * 120;
    const y = 128 + random() * 88;
    const r = 0.4 + random() * random() * 1.4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${random() < 0.5 ? '#c9c7a4' : '#2a2a1c'}" fill-opacity="${(0.25 + random() * 0.35).toFixed(2)}"/>`;
  }).join('');
  return `<path d="${smooth([[74, 206], [100, 200], [128, 203], [156, 199], [182, 205], [160, 220], [128, 224], [96, 220]])}" fill="#1a1f12" fill-opacity="0.75" filter="url(#wash)"/>
    ${motes}`;
}

function bubbles(): string {
  const items: [number, number, number][] = [[152, 142, 2.6], [158, 131, 1.8], [96, 136, 2], [140, 133, 1.3]];
  return items
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#d6dcc4" stroke-opacity="0.55" stroke-width="0.7"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="${HIGHLIGHT}" fill-opacity="0.8"/>`)
    .join('');
}

/** Подставка: кольцо и ножки из меди, покрытой патиной. */
function stand(): { back: string; front: string } {
  const legs: Pt[][] = [
    [[84, 206], [76, 226], [72, 240]],
    [[172, 206], [180, 226], [184, 240]],
    [[128, 214], [128, 230], [128, 242]],
  ];
  const legPaths = legs
    .map((leg, i) => `<path d="${ink(leg, { width: 4, taper: [0, 0.2], shade: 0.6, seed: 120 + i })}" fill="url(#verdigris)"/>${inkPath(ink(leg, { width: 1.2, taper: [0, 0.1], shade: 0, seed: 130 + i }), INK, 0.4)}`)
    .join('');
  const ringBack = ellipse([128, 206], 52, 9, 16, Math.PI, Math.PI * 2);
  const ringFront = ellipse([128, 206], 52, 9, 16, 0, Math.PI);
  return {
    back: `${legPaths}${inkPath(ink(ringBack, { width: 4.5, taper: [0.05, 0.05], shade: 0, seed: 140 }), '#3c5248')}`,
    front: `<path d="${ink(ringFront, { width: 6, taper: [0.05, 0.05], shade: 0.5, seed: 141 })}" fill="url(#verdigris)"/>` +
      inkPath(ink(ellipse([128, 208], 52, 9, 16, 0.15, Math.PI - 0.15), { width: 1.4, taper: [0.2, 0.2], shade: 0, seed: 142 }), INK, 0.85) +
      inkPath(ink(ellipse([128, 204], 50, 8, 16, 0.35, Math.PI - 0.9), { width: 1, taper: [0.3, 0.3], shade: 0, seed: 143 }), '#c99a64', 0.7),
  };
}

/** Бумажный ярлык на бечёвке: срезанный угол, знак Ртути и неразборчивая запись. */
function tag(): string {
  const card: Pt[] = [[78, 64], [101, 59], [106, 64], [110, 83], [83, 89]];
  const string = ink([[117, 88], [111, 79], [103, 66]], { width: 0.9, taper: [0, 0], shade: 0, pressure: 0.2, seed: 150 });
  const lines: Pt[][] = [
    [[86, 81], [91, 79], [95, 80], [100, 78]],
    [[87, 85], [93, 83.5], [97, 84], [103, 82]],
  ];
  const writing = lines
    .map((line, i) => inkPath(ink(line, { width: 0.8, taper: [0.2, 0.3], shade: 0, pressure: 0.6, seed: 152 + i }), '#2a1a12', 0.8))
    .join('');
  return `<path d="${string}" fill="#3a2c20"/>
    <path d="${polyD(card)}" fill="#bba57a" filter="url(#wash)"/>
    <path d="${polyD(card)}" fill="url(#tag-age)"/>
    ${inkPath(ink(card, { width: 1, closed: true, shade: 0.6, seed: 151, raw: true }), INK, 0.8)}
    <circle cx="101.5" cy="64.5" r="1.4" fill="#2a1e14"/>
    <!-- Знак Ртути: рожки, круг, крест -->
    <g fill="none" stroke="#2a1a12" stroke-width="1.1" stroke-linecap="round" transform="rotate(-11 90 70)">
      <path d="M86.6 64.6 Q90 67.6 93.4 64.6"/><circle cx="90" cy="70" r="3"/><path d="M90 73 V78 M87.4 75.6 H92.6"/>
    </g>
    ${writing}`;
}

function render(): string {
  const flaskD = smooth(FLASK);
  const extra = [
    radial('liquid', [124, 166], 72, [
      [0, '#b9bf8a'],
      [0.2, '#6f8a62'],
      [0.48, '#2f4a39'],
      [0.8, '#152a20'],
      [1, '#0b1812'],
    ]),
    radial('aura', [126, 166], 38, [
      [0, '#efe9bc', 0.9],
      [0.5, '#c4ca92', 0.45],
      [1, '#9aa874', 0],
    ]),
    `<filter id="soft-edge" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7"/></filter>`,
    radial('skin', [126, 166], 32, [
      [0, '#f6f1e0'],
      [0.55, '#d9cfb3'],
      [1, '#a39478'],
    ], [122, 160]),
    linear('gold', [118, 86], [140, 98], [
      [0, '#d8bd7c'],
      [0.45, '#9c7a3a'],
      [1, '#5a4016'],
    ]),
    linear('wax', [112, 14], [146, 40], [
      [0, '#6e2420'],
      [0.55, '#4a1512'],
      [1, '#2a0a08'],
    ]),
    linear('verdigris', [60, 200], [196, 240], [
      [0, '#6f9482'],
      [0.35, '#5a6e58'],
      [0.6, '#5e4630'],
      [1, '#2a1c12'],
    ]),
    linear('glass-empty', [0, 40], [0, 124], [
      [0, '#6f8478', 0.35],
      [1, '#8fa294', 0.32],
    ]),
    linear('tag-age', [76, 60], [109, 88], [
      [0, '#fff', 0],
      [1, '#5a3a1a', 0.35],
    ]),
    `<clipPath id="flask-clip"><path d="${flaskD}"/></clipPath>`,
    `<clipPath id="liquid-clip"><path d="${smooth(LIQUID)}"/></clipPath>`,
    `<clipPath id="creature-clip"><path d="${smooth([[106, 140], [116, 134], [128, 142], [144, 162], [146, 182], [134, 190], [112, 188], [108, 176], [106, 160]])}"/></clipPath>`,
    `<mask id="liquid-dark" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="url(#liquid-mask)"/></mask>`,
    radial('liquid-mask', [126, 166], 72, [
      [0, '#000'],
      [0.5, '#000'],
      [1, '#fff'],
    ]),
  ].join('');
  const standParts = stand();

  // Разводы и грязь на стекле, трещина в правом плече колбы
  const random = rng(77);
  const grime = Array.from({ length: 7 }, (_, i) => {
    const x = 74 + i * 18 + random() * 8;
    const top = 112 + random() * 30;
    return inkPath(ink([[x, top], [x + 1 - random() * 2, top + 25], [x + 2 - random() * 4, top + 55 + random() * 20]], { width: 2.2 + random() * 2, taper: [0.5, 0.6], shade: 0, pressure: 0.5, seed: 160 + i }), '#4a4a30', 0.18);
  }).join('');
  const crack = `<path d="M170 112 L176 120 L173 126 L181 133 L178 139" fill="none" stroke="#f0ead8" stroke-opacity="0.7" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M171 113 L177 121 L174 127 L182 134" fill="none" stroke="#0e1a14" stroke-opacity="0.55" stroke-width="0.7" stroke-linejoin="round"/>`;

  // Блики стекла: отражение пламени свечи сверху слева, блик горла, холодная кромка справа
  const glassLights = `
    ${candleReflection(88, 138, 7, 0.95)}
    <path d="${smooth([[121, 46], [123.5, 44], [123.5, 82], [121, 86]])}" fill="${HIGHLIGHT}" fill-opacity="0.45"/>
    <path d="${smooth([[186, 140], [190, 162], [184, 186], [172, 202], [178, 182], [182, 160]])}" fill="#bcd0c8" fill-opacity="0.35" filter="url(#wash-soft)"/>`;

  return svg(`${defs(extra)}
  <ellipse cx="128" cy="241" rx="72" ry="7" fill="#120c08" fill-opacity="0.55" filter="url(#blur-4)"/>
  ${standParts.back}

  <!-- Колба: пустое стекло, жидкость с осадком, существо -->
  <path d="${flaskD}" fill="url(#glass-empty)"/>
  <g clip-path="url(#liquid-clip)">
    <path d="${smooth(LIQUID)}" fill="url(#liquid)" filter="url(#wash)"/>
    ${hatch({ clip: 'liquid-clip', mask: 'liquid-dark', angle: 60, spacing: 3.2, width: 0.8, bounds: [60, 116, 196, 224], seed: 13, opacity: 0.45 })}
    ${sediment()}
    ${creature()}
    ${bubbles()}
    ${coldShade('liquid-shade', 'liquid-clip', [90, 130], [190, 215], 0.5)}
  </g>
  ${inkPath(ink(ellipse([128, 125], 60, 5.5, 20, 0, Math.PI * 2), { width: 1.1, closed: true, shade: 0, seed: 70 }), '#aeb99c', 0.5)}
  <g clip-path="url(#flask-clip)">
    <!-- Толщина стекла: тёмная кайма по краю -->
    <path d="${flaskD}" fill="none" stroke="#0c1a14" stroke-opacity="0.5" stroke-width="5" filter="url(#blur-2)"/>
    ${grime}
  </g>
  ${crack}
  ${glassLights}
  ${inkPath(ink(FLASK, { width: 3.6, closed: false, taper: [0, 0], shade: 0.8, seed: 71 }))}

  <!-- Потускневший золотой поясок на горле -->
  <path d="M114 84 Q128 89 142 84 L142 93 Q128 98 114 93 Z" fill="url(#gold)"/>
  ${inkPath(ink([[114, 84], [128, 89], [142, 84]], { width: 1.1, taper: [0.1, 0.1], shade: 0, seed: 72 }), GOLD_DARK)}
  ${inkPath(ink([[114, 93], [128, 98], [142, 93]], { width: 1.3, taper: [0.1, 0.1], shade: 0, seed: 73 }), GOLD_DARK)}
  <path d="M117 88.3 Q122 90.2 127 90.6" fill="none" stroke="#f3dca0" stroke-width="1" stroke-opacity="0.8"/>
  ${tag()}

  <!-- Потрескавшийся сургуч с потёками и стёртым знаком -->
  <path d="${smooth([[110, 36], [112, 24], [120, 16], [136, 16], [144, 24], [146, 36], [142, 44], [140, 52], [137, 45], [131, 42], [124, 46], [120, 41], [116, 48], [113, 42]])}" fill="url(#wax)" filter="url(#wash)"/>
  ${inkPath(ink([[110, 36], [112, 24], [120, 16], [136, 16], [144, 24], [146, 36], [142, 44], [140, 52]], { width: 2, taper: [0.2, 0.3], shade: 0.8, seed: 74 }))}
  <circle cx="128" cy="28" r="6.5" fill="url(#gold)" fill-opacity="0.8"/>
  <path d="M128 23 L132 31 L124 31 Z M124 27 L132 27" fill="none" stroke="${GOLD_DARK}" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M118 22 L123 29 L120 35 M137 20 L134 26" fill="none" stroke="#120504" stroke-width="0.9" stroke-opacity="0.8"/>
  <path d="${smooth([[117, 20], [124, 18], [120, 23]])}" fill="${HIGHLIGHT}" fill-opacity="0.45"/>

  ${standParts.front}
  `);
}

export const homunculus: ElementArt = { id: 'homunculus', render };
