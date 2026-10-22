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
 * Гомункул — тайное открытие. Запечатанная колба на подставке из окисленной меди;
 * в тёмной зеленоватой жидкости свернулось маленькое существо, и свет исходит от него самого.
 * Золото (пояс на горле, знак на печати, искры) — признак редкости, его больше нигде в серии нет.
 */

const GOLD_DARK = '#7a5418';
const SKIN_INK = '#5b3826';

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
  return `<ellipse cx="126" cy="166" rx="44" ry="40" fill="url(#aura)" filter="url(#blur-4)"/>
    <g filter="url(#soft-edge)" opacity="0.94">${fills}</g>
    <ellipse cx="128" cy="170" rx="9" ry="8" fill="#fffbea" fill-opacity="0.8" filter="url(#blur-4)"/>
    ${line(body, 1.1, 61, 0.5)}${line(leg, 0.9, 62, 0.45)}${line(head, 1.1, 63, 0.55)}${line(arm, 0.8, 64, 0.4)}
    <ellipse cx="112.5" cy="146.5" rx="3.2" ry="2.2" fill="#c99a76" fill-opacity="0.45" filter="url(#soft-edge)"/>
    ${inkPath(ink([[110.5, 146.6], [112.8, 147.6], [115, 147]], { width: 0.9, taper: [0.3, 0.5], shade: 0, seed: 65 }), SKIN_INK, 0.8)}
    ${inkPath(ink([[120, 146], [122, 148], [121, 151], [119, 151]], { width: 0.8, taper: [0.3, 0.4], shade: 0, seed: 67 }), SKIN_INK, 0.45)}
    ${inkPath(ink([[133, 157], [140, 164], [143, 174]], { width: 0.9, taper: [0.5, 0.5], shade: 0, seed: 66 }), SKIN_INK, 0.35)}
    <path d="${smooth([[110, 145], [114, 141], [119, 141], [114, 144]])}" fill="${HIGHLIGHT}" fill-opacity="0.8"/>`;
}

function bubbles(): string {
  const items: [number, number, number][] = [
    [150, 140, 3.2], [158, 128, 2.2], [96, 134, 2.6], [88, 176, 1.8], [166, 190, 2.4], [140, 132, 1.6], [104, 196, 1.8],
  ];
  return items
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#cfe3c4" fill-opacity="0.25" stroke="#e8f0d8" stroke-opacity="0.7" stroke-width="0.8"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="${HIGHLIGHT}"/>`)
    .join('');
}

/** Четырёхлучевая золотая искра. */
function sparkle(x: number, y: number, r: number): string {
  const d = `M${x} ${y - r}Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y}Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r}Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y}Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z`;
  return `<circle cx="${x}" cy="${y}" r="${r * 0.9}" fill="#f2d27a" fill-opacity="0.45" filter="url(#blur-2)"/><path d="${d}" fill="#f6dc8e"/>`;
}

/** Подставка: кольцо и ножки из окисленной меди. */
function stand(): { back: string; front: string } {
  const legs: Pt[][] = [
    [[84, 206], [76, 226], [72, 240]],
    [[172, 206], [180, 226], [184, 240]],
    [[128, 214], [128, 230], [128, 242]],
  ];
  const legPaths = legs
    .map((leg, i) => `<path d="${ink(leg, { width: 4, taper: [0, 0.2], shade: 0.6, seed: 120 + i })}" fill="url(#verdigris)"/>${inkPath(ink(leg, { width: 1.2, taper: [0, 0.1], shade: 0, seed: 130 + i }), INK, 0.3)}`)
    .join('');
  const ringBack = ellipse([128, 206], 52, 9, 16, Math.PI, Math.PI * 2);
  const ringFront = ellipse([128, 206], 52, 9, 16, 0, Math.PI);
  return {
    back: `${legPaths}${inkPath(ink(ringBack, { width: 4.5, taper: [0.05, 0.05], shade: 0, seed: 140 }), '#4f6a58')}`,
    front: `<path d="${ink(ringFront, { width: 6, taper: [0.05, 0.05], shade: 0.5, seed: 141 })}" fill="url(#verdigris)"/>` +
      inkPath(ink(ellipse([128, 208], 52, 9, 16, 0.15, Math.PI - 0.15), { width: 1.4, taper: [0.2, 0.2], shade: 0, seed: 142 }), INK, 0.8) +
      inkPath(ink(ellipse([128, 204], 50, 8, 16, 0.35, Math.PI - 0.6), { width: 1, taper: [0.3, 0.3], shade: 0, seed: 143 }), '#d8c48c', 0.8),
  };
}

function render(): string {
  const flaskD = smooth(FLASK);
  const extra = [
    radial('liquid', [126, 166], 72, [
      [0, '#efe3a6'],
      [0.22, '#b9c98c'],
      [0.5, '#4f8068'],
      [0.8, '#24493f'],
      [1, '#14302a'],
    ]),
    radial('aura', [126, 166], 44, [
      [0, '#fff6cf', 0.95],
      [0.45, '#f1dd96', 0.6],
      [1, '#e0c97e', 0],
    ]),
    `<filter id="soft-edge" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7"/></filter>`,
    radial('skin', [126, 166], 32, [
      [0, '#fffbe9'],
      [0.5, '#f5e2bc'],
      [1, '#d8b088'],
    ], [122, 160]),
    radial('rare-glow', [128, 150], 112, [
      [0, '#f0cf72', 0.55],
      [0.6, '#e8c260', 0.2],
      [1, '#e8c260', 0],
    ]),
    linear('gold', [118, 86], [140, 98], [
      [0, '#f8e3a0'],
      [0.45, '#d4a64a'],
      [1, '#8a6020'],
    ]),
    linear('wax', [112, 14], [146, 40], [
      [0, '#a8433a'],
      [0.55, '#7a2620'],
      [1, '#4f1714'],
    ]),
    linear('verdigris', [60, 200], [196, 240], [
      [0, '#7fa08a'],
      [0.3, '#8a6a46'],
      [0.6, '#6e4a2e'],
      [1, '#3e2a1c'],
    ]),
    linear('glass-empty', [0, 40], [0, 124], [
      [0, '#dfe8d8', 0.25],
      [1, '#b9cbbd', 0.35],
    ]),
    `<clipPath id="flask-clip"><path d="${flaskD}"/></clipPath>`,
    `<clipPath id="liquid-clip"><path d="${smooth(LIQUID)}"/></clipPath>`,
    `<mask id="liquid-dark" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="url(#liquid-mask)"/></mask>`,
    radial('liquid-mask', [126, 166], 72, [
      [0, '#000'],
      [0.55, '#000'],
      [1, '#fff'],
    ]),
  ].join('');
  const standParts = stand();

  // Блики стекла: отражение окна (как у капли воды), блик горла, светлая кромка справа
  const glassLights = `
    <path d="${polyD([[79, 134], [88, 127], [90, 140], [82, 147]])}" fill="${HIGHLIGHT}" fill-opacity="0.85"/>
    <path d="${polyD([[91, 125], [99, 121], [100, 134], [93, 139]])}" fill="${HIGHLIGHT}" fill-opacity="0.85"/>
    <path d="${polyD([[83, 151], [90, 145], [92, 157], [86, 163]])}" fill="${HIGHLIGHT}" fill-opacity="0.55"/>
    <path d="${polyD([[94, 143], [101, 138], [102, 150], [96, 155]])}" fill="${HIGHLIGHT}" fill-opacity="0.5"/>
    <path d="${smooth([[121, 44], [124, 42], [124, 84], [121, 88]])}" fill="${HIGHLIGHT}" fill-opacity="0.8"/>
    <path d="${smooth([[186, 140], [190, 162], [184, 186], [172, 202], [178, 182], [182, 160]])}" fill="${HIGHLIGHT}" fill-opacity="0.5" filter="url(#wash-soft)"/>`;

  return svg(`${defs(extra)}
  <!-- Золотое сияние редкой находки -->
  <ellipse cx="128" cy="150" rx="112" ry="108" fill="url(#rare-glow)" filter="url(#glow)"/>
  <ellipse cx="128" cy="240" rx="70" ry="7" fill="#3a2a1a" fill-opacity="0.35" filter="url(#blur-4)"/>
  ${standParts.back}

  <!-- Колба: пустое стекло, жидкость, существо -->
  <path d="${flaskD}" fill="url(#glass-empty)"/>
  <g clip-path="url(#liquid-clip)">
    <path d="${smooth(LIQUID)}" fill="url(#liquid)" filter="url(#wash)"/>
    ${hatch({ clip: 'liquid-clip', mask: 'liquid-dark', angle: 60, spacing: 3.4, width: 0.8, bounds: [60, 116, 196, 224], seed: 13, opacity: 0.35 })}
    ${creature()}
    ${bubbles()}
  </g>
  ${inkPath(ink(ellipse([128, 125], 60, 5.5, 20, 0, Math.PI * 2), { width: 1.2, closed: true, shade: 0, seed: 70 }), '#d9e6c8', 0.6)}
  <g clip-path="url(#flask-clip)">
    <!-- Толщина стекла: тёмная кайма по краю -->
    <path d="${flaskD}" fill="none" stroke="#163a33" stroke-opacity="0.35" stroke-width="4" filter="url(#blur-2)"/>
  </g>
  ${glassLights}
  ${inkPath(ink(FLASK, { width: 3.6, closed: false, taper: [0, 0], shade: 0.75, seed: 71 }))}

  <!-- Позолоченный пояс на горле -->
  <path d="M114 84 Q128 89 142 84 L142 93 Q128 98 114 93 Z" fill="url(#gold)"/>
  ${inkPath(ink([[114, 84], [128, 89], [142, 84]], { width: 1.1, taper: [0.1, 0.1], shade: 0, seed: 72 }), GOLD_DARK)}
  ${inkPath(ink([[114, 93], [128, 98], [142, 93]], { width: 1.3, taper: [0.1, 0.1], shade: 0, seed: 73 }), GOLD_DARK)}
  <path d="M118 88.5 Q128 92 138 88.5" fill="none" stroke="#fff3c4" stroke-width="1" stroke-opacity="0.9"/>

  <!-- Сургучная печать с потёками и золотым знаком -->
  <path d="${smooth([[110, 36], [112, 24], [120, 16], [136, 16], [144, 24], [146, 36], [142, 44], [140, 52], [137, 45], [131, 42], [124, 46], [120, 41], [116, 48], [113, 42]])}" fill="url(#wax)" filter="url(#wash)"/>
  ${inkPath(ink([[110, 36], [112, 24], [120, 16], [136, 16], [144, 24], [146, 36], [142, 44], [140, 52]], { width: 2, taper: [0.2, 0.3], shade: 0.8, seed: 74 }))}
  <circle cx="128" cy="28" r="6.5" fill="url(#gold)"/>
  <path d="M128 23 L132 31 L124 31 Z M124 27 L132 27" fill="none" stroke="${GOLD_DARK}" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="${smooth([[117, 20], [124, 18], [120, 23]])}" fill="${HIGHLIGHT}" fill-opacity="0.6"/>

  ${standParts.front}
  ${sparkle(58, 70, 7)}
  ${sparkle(196, 96, 5)}
  ${sparkle(176, 46, 3.5)}
  `);
}

export const homunculus: ElementArt = { id: 'homunculus', render };
