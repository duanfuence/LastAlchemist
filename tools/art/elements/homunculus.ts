import {
  HIGHLIGHT,
  INK,
  candleReflection,
  coldShade,
  defs,
  edge,
  ellipse,
  groundShadow,
  ink,
  inkPath,
  linear,
  polyD,
  radial,
  relief,
  rimDark,
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

/**
 * Существо, свернувшееся калачиком, лицом к свету: крупная голова с высоким лбом,
 * ухо, рука с крошечными пальцами у подбородка, колени подтянуты к груди,
 * по выгнутой спине проступают позвонки. Кожа тонкая и полупрозрачная: свет
 * идёт изнутри, по краю — тёплая розоватая кайма, как у пальцев против свечи.
 */
const HEAD: Pt[] = [[103, 136], [116, 132], [127, 139], [130, 151], [124, 162], [114, 166], [104, 165], [99, 161], [96.5, 157.5], [94, 154], [95.5, 151], [94.5, 147], [97, 141]];
const TORSO: Pt[] = [[118, 160], [128, 150], [142, 151], [154, 161], [160, 177], [156, 192], [144, 201], [130, 202], [118, 195], [112, 182], [113, 170]];
const LEG: Pt[] = [[148, 194], [132, 199], [114, 196], [104, 189], [103, 181], [110, 178], [124, 181], [140, 182], [152, 184]];
const SHIN: Pt[] = [[106, 186], [108, 196], [118, 205], [131, 208], [140, 207], [139, 202], [128, 200], [117, 194], [112, 186]];
const ARM: Pt[] = [[133, 168], [130, 181], [120, 188], [110, 184], [102.5, 172], [100.5, 167.5], [104, 166.5], [110, 175], [118, 180], [125, 172]];

function creature(): string {
  const shapes = [TORSO, SHIN, LEG, HEAD, ARM];
  const fills = shapes.map((shape) => `<path d="${smooth(shape)}" fill="url(#skin)"/>`).join('');
  const rims = shapes.map((shape) => `<path d="${smooth(shape)}" fill="#000" filter="url(#skin-rim)"/>`).join('');
  const shades = shapes.map((shape) => `<path d="${smooth(shape)}" fill="#000" filter="url(#skin-shade)"/>`).join('');
  const line = (shape: Pt[], width: number, seed: number, opacity: number): string =>
    inkPath(ink(shape, { width, closed: true, shade: 1.3, pressure: 0.3, seed }), SKIN_INK, opacity);
  // Прожилки под прозрачной кожей
  const veins: Pt[][] = [
    [[106, 140], [112, 143], [116, 141], [121, 145]],
    [[136, 158], [144, 166], [148, 178]],
    [[124, 186], [132, 190], [140, 190]],
  ];
  const veinPaths = veins.map((v, i) => inkPath(ink(v, { width: 0.8, taper: [0.4, 0.4], shade: 0, pressure: 0.4, seed: 90 + i }), '#7a4250', 0.35)).join('');
  // Позвонки: цепочка бугорков вдоль выгнутой спины
  const spine = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4;
    const a = -1.25 + t * 1.6;
    const x = 136 + Math.cos(a) * 24.5;
    const y = 176 + Math.sin(a) * 24.5;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.2" ry="1.3" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#fff6e4" fill-opacity="0.4"/>` +
      `<path d="M${(x + Math.cos(a) * 1.8).toFixed(1)} ${(y + Math.sin(a) * 1.8).toFixed(1)} l${(Math.cos(a + 1.57) * 2).toFixed(1)} ${(Math.sin(a + 1.57) * 2).toFixed(1)}" stroke="${SKIN_INK}" stroke-opacity="0.35" stroke-width="0.7"/>`;
  }).join('');
  // Пальцы у подбородка
  const fingers = [[[100.5, 168], [97.5, 165.5], [97.5, 163.5]], [[102.5, 167], [100.5, 163.5], [101.5, 161.8]], [[104.5, 167.5], [104, 164], [105.5, 162.6]]] as Pt[][];
  const fingerPaths = fingers.map((f, i) => `<path d="${ink(f, { width: 2, taper: [0, 0.5], shade: 0, seed: 170 + i })}" fill="url(#skin)"/>${inkPath(ink(f, { width: 0.6, taper: [0, 0.4], shade: 0, seed: 175 + i }), SKIN_INK, 0.55)}`).join('');
  // Пуповина уходит вниз, в осадок
  const cord = ink([[122, 196], [118, 204], [126, 210], [120, 216], [126, 222]], { width: 2.6, taper: [0.1, 0.5], shade: 0.4, pressure: 0.3, seed: 95 });
  return `<path d="${cord}" fill="#b5a28e" fill-opacity="0.8"/>
    <g opacity="0.88">${fills}${shades}${rims}</g>
    ${veinPaths}${spine}
    ${line(TORSO, 1.1, 61, 0.5)}${line(SHIN, 0.8, 68, 0.32)}${line(LEG, 0.8, 62, 0.32)}${inkPath(ink([...HEAD.slice(7), ...HEAD.slice(0, 5)], { width: 1.3, taper: [0.25, 0.4], shade: 1.3, pressure: 0.3, seed: 63 }), SKIN_INK, 0.65)}${line(ARM, 0.8, 64, 0.42)}
    ${fingerPaths}
    <!-- Ухо -->
    <path d="${smooth([[117, 147], [121, 145], [123, 150], [120, 155], [117, 153]])}" fill="#e7c9b4" fill-opacity="0.8"/>
    ${inkPath(ink([[117.5, 147.5], [121.5, 146], [123, 150.5], [120, 155]], { width: 0.9, taper: [0.2, 0.4], shade: 0, seed: 66 }), SKIN_INK, 0.6)}
    <!-- Глаз чуть приоткрыт: тёмная щель под тяжёлым веком и крошечный отблеск -->
    <ellipse cx="102" cy="148.5" rx="4.4" ry="3" fill="#8f7666" fill-opacity="0.4" filter="url(#soft-edge)"/>
    <path d="M98.6 148.4 Q102 146.8 105.6 148.6 Q102 150.6 98.6 148.4 Z" fill="#140d0b"/>
    <circle cx="103.4" cy="148.2" r="0.7" fill="#f3efe0"/>
    ${inkPath(ink([[98.2, 148], [102, 146.2], [106, 148.3]], { width: 1, taper: [0.3, 0.4], shade: 0, seed: 65 }), SKIN_INK, 0.85)}
    <!-- Нос и рот -->
    ${inkPath(ink([[95, 151], [93.8, 153.5], [96, 155]], { width: 0.8, taper: [0.3, 0.4], shade: 0, seed: 67 }), SKIN_INK, 0.55)}
    ${inkPath(ink([[96.5, 158.5], [99.5, 159.2]], { width: 0.7, taper: [0.3, 0.4], shade: 0, seed: 69 }), SKIN_INK, 0.5)}
    <path d="${smooth([[100, 139], [108, 135], [116, 135], [108, 139]])}" fill="${HIGHLIGHT}" fill-opacity="0.6"/>`;
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

/** Пузырьки: цепочка изо рта к поверхности и несколько у стенки. */
function bubbles(): string {
  const items: [number, number, number][] = [[92, 154, 1.4], [89.5, 146, 1.8], [88, 137, 2.2], [89, 130.5, 1.4], [158, 142, 2.4], [164, 133, 1.6], [146, 134, 1.2]];
  return items
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#dfe6c8" fill-opacity="0.12" stroke="#e3e9cf" stroke-opacity="0.6" stroke-width="0.6"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.32}" fill="${HIGHLIGHT}" fill-opacity="0.85"/>`)
    .join('');
}

/** Подставка: кольцо и ножки из старой меди, покрытой патиной. */
function stand(): { back: string; front: string } {
  const legs: Pt[][] = [
    [[84, 206], [76, 226], [72, 240]],
    [[172, 206], [180, 226], [184, 240]],
    [[128, 214], [128, 230], [128, 242]],
  ];
  const legPaths = legs
    .map((leg, i) => `<path d="${ink(leg, { width: 4.6, taper: [0, 0.15], shade: 0.6, seed: 120 + i })}" fill="url(#verdigris)" filter="url(#r-copper)"/>${inkPath(ink(leg, { width: 1.1, taper: [0, 0.1], shade: 0, seed: 130 + i }), INK, 0.5)}<ellipse cx="${leg[2]![0]}" cy="${leg[2]![1] + 1}" rx="4" ry="1.6" fill="#3a2a1c"/>`)
    .join('');
  const ringBack = ellipse([128, 206], 52, 9, 16, Math.PI, Math.PI * 2);
  const ringFront = ellipse([128, 206], 52, 9, 16, 0, Math.PI);
  return {
    back: `${legPaths}${inkPath(ink(ringBack, { width: 4.5, taper: [0.05, 0.05], shade: 0, seed: 140 }), '#2e3e36')}`,
    front: `<path d="${ink(ringFront, { width: 6.5, taper: [0.05, 0.05], shade: 0.5, seed: 141 })}" fill="url(#verdigris)" filter="url(#r-copper)"/>` +
      inkPath(ink(ellipse([128, 208.5], 52, 9, 16, 0.15, Math.PI - 0.15), { width: 1.4, taper: [0.2, 0.2], shade: 0, seed: 142 }), INK, 0.85) +
      inkPath(ink(ellipse([128, 204], 50, 8, 16, 0.4, Math.PI - 1), { width: 1, taper: [0.3, 0.3], shade: 0, seed: 143 }), '#e0b07a', 0.8),
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
    radial('liquid', [122, 168], 76, [
      [0, '#cfd59c'],
      [0.22, '#86a06c'],
      [0.5, '#365640'],
      [0.82, '#142b1e'],
      [1, '#09150e'],
    ]),
    radial('aura', [124, 170], 52, [
      [0, '#fbf3cc', 0.95],
      [0.45, '#d4d99c', 0.4],
      [1, '#9aa874', 0],
    ]),
    `<filter id="soft-edge" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7"/></filter>`,
    radial('skin', [118, 168], 44, [
      [0, '#fff6df'],
      [0.45, '#efd9bf'],
      [0.8, '#d1b39a'],
      [1, '#a98c76'],
    ], [112, 160]),
    edge('skin-rim', { dx: -2.5, dy: -2, blur: 1.4, color: '#e9a99a', opacity: 0.55 }),
    edge('skin-shade', { dx: -6, dy: -7, blur: 4, color: '#5e4a3c', opacity: 0.4 }),
    linear('gold', [118, 86], [140, 98], [
      [0, '#d8bd7c'],
      [0.45, '#9c7a3a'],
      [1, '#5a4016'],
    ]),
    linear('wax', [112, 14], [146, 40], [
      [0, '#7a2a24'],
      [0.55, '#4e1714'],
      [1, '#2a0a08'],
    ]),
    linear('verdigris', [60, 200], [196, 240], [
      [0, '#86a894'],
      [0.3, '#6c7e64'],
      [0.55, '#8a6440'],
      [1, '#3a2616'],
    ]),
    linear('glass-empty', [0, 40], [0, 124], [
      [0, '#6f8478', 0.3],
      [1, '#8fa294', 0.28],
    ]),
    linear('tag-age', [76, 60], [109, 88], [
      [0, '#fff', 0],
      [1, '#5a3a1a', 0.35],
    ]),
    linear('ray', [0, 128], [0, 176], [
      [0, '#f3efc6', 0],
      [0.6, '#f3efc6', 0.16],
      [1, '#f3efc6', 0.05],
    ]),
    `<clipPath id="flask-clip"><path d="${flaskD}"/></clipPath>`,
    `<clipPath id="liquid-clip"><path d="${smooth(LIQUID)}"/></clipPath>`,
    rimDark('glass-fresnel', 7, '#06110b', 0.8),
    edge('glass-lit', { dx: 2.6, dy: 3.2, blur: 0.8, color: HIGHLIGHT, opacity: 0.55 }),
    edge('glass-cold', { dx: -4, dy: -3, blur: 1.6, color: '#c6dccf', opacity: 0.35 }),
    relief('r-copper', { frequency: 0.09, octaves: 3, roughness: 0.6, dome: 1.6, depth: 5, gloss: 0.9, sharpness: 16, strength: 0.8, seed: 41 }),
    relief('r-wax', { frequency: 0.08, octaves: 3, roughness: 0.45, dome: 4, depth: 9, gloss: 0.6, sharpness: 20, strength: 0.8, seed: 42 }),
  ].join('');
  const standParts = stand();

  // Разводы и грязь на стекле, трещина в правом плече колбы
  const random = rng(77);
  const grime = [70, 80, 166, 176, 186].map((x0, i) => {
    const x = x0 + random() * 6;
    const top = 112 + random() * 30;
    return inkPath(ink([[x, top], [x + 1 - random() * 2, top + 25], [x + 2 - random() * 4, top + 55 + random() * 20]], { width: 2.2 + random() * 2, taper: [0.5, 0.6], shade: 0, pressure: 0.5, seed: 160 + i }), '#4a4a30', 0.16);
  }).join('');
  const crack = `<path d="M170 112 L176 120 L173 126 L181 133 L178 139" fill="none" stroke="#f0ead8" stroke-opacity="0.7" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M171 113 L177 121 L174 127 L182 134" fill="none" stroke="#0e1a14" stroke-opacity="0.55" stroke-width="0.7" stroke-linejoin="round"/>`;
  // Слабые лучи света от существа к поверхности жидкости
  const rays = [[-22, 7], [-6, 9], [12, 8], [28, 6]]
    .map(([dx, w]) => `<path d="M${124 + dx! * 0.3} 170 L${124 + dx! - w!} 124 L${124 + dx! + w!} 124 Z" fill="url(#ray)" filter="url(#blur-2)"/>`)
    .join('');

  // Блики стекла: отражения пламени свечи на теле и горле, холодная кромка справа
  const glassLights = `
    ${candleReflection(86, 140, 7.5, 0.95)}
    ${candleReflection(122.5, 58, 3.2, 0.8)}
    <path d="${smooth([[121, 64], [123.5, 62], [123.5, 84], [121, 88]])}" fill="${HIGHLIGHT}" fill-opacity="0.4"/>
    <path d="${smooth([[74, 160], [76, 176], [86, 194], [80, 192], [72, 176]])}" fill="${HIGHLIGHT}" fill-opacity="0.18"/>`;

  return svg(`${defs(extra)}
  ${groundShadow(136, 240, 70, 7)}
  <!-- Свет, прошедший сквозь зелёную жидкость, ложится на стол -->
  <ellipse cx="150" cy="240" rx="34" ry="5" fill="#cfe09a" fill-opacity="0.35" filter="url(#blur-2)"/>
  ${standParts.back}

  <!-- Колба: пустое стекло, жидкость с осадком, существо -->
  <path d="${flaskD}" fill="url(#glass-empty)"/>
  <g clip-path="url(#liquid-clip)">
    <path d="${smooth(LIQUID)}" fill="url(#liquid)" filter="url(#wash)"/>
    ${rays}
    <ellipse cx="124" cy="172" rx="46" ry="42" fill="url(#aura)" filter="url(#blur-4)"/>
    ${sediment()}
    ${creature()}
    <!-- Свет изнутри: существо слабо светится сквозь кожу -->
    <ellipse cx="120" cy="170" rx="30" ry="30" fill="#fff0c4" fill-opacity="0.32" filter="url(#blur-8)" style="mix-blend-mode:screen"/>
    ${bubbles()}
    ${coldShade('liquid-shade', 'liquid-clip', [100, 130], [192, 218], 0.45)}
  </g>
  <!-- Мениск: светлая линия и тёмный край снизу -->
  ${inkPath(ink(ellipse([128, 125], 61, 5.5, 20, 0, Math.PI * 2), { width: 1.1, closed: true, shade: 0, seed: 70 }), '#c2ccab', 0.55)}
  ${inkPath(ink(ellipse([128, 126.5], 60, 5.5, 14, 0.2, Math.PI - 0.2), { width: 1, taper: [0.3, 0.3], shade: 0, seed: 76 }), '#0b1710', 0.5)}
  <g clip-path="url(#flask-clip)">
    <!-- Толщина стекла: потемнение по краю, светлая внутренняя кромка к свече, холодная — в тени -->
    <path d="${flaskD}" fill="#000" filter="url(#glass-fresnel)"/>
    <path d="${flaskD}" fill="#000" filter="url(#glass-lit)"/>
    <path d="${flaskD}" fill="#000" filter="url(#glass-cold)"/>
    ${grime}
  </g>
  ${crack}
  ${glassLights}
  ${inkPath(ink(FLASK, { width: 3, closed: false, taper: [0, 0], shade: 0.9, seed: 71 }))}

  <!-- Потускневший золотой поясок на горле -->
  <path d="M114 84 Q128 89 142 84 L142 93 Q128 98 114 93 Z" fill="url(#gold)" filter="url(#r-copper)"/>
  ${inkPath(ink([[114, 84], [128, 89], [142, 84]], { width: 1.1, taper: [0.1, 0.1], shade: 0, seed: 72 }), GOLD_DARK)}
  ${inkPath(ink([[114, 93], [128, 98], [142, 93]], { width: 1.3, taper: [0.1, 0.1], shade: 0, seed: 73 }), GOLD_DARK)}
  <path d="M117 88.3 Q122 90.2 127 90.6" fill="none" stroke="#f3dca0" stroke-width="1" stroke-opacity="0.8"/>
  ${tag()}

  <!-- Потрескавшийся сургуч с потёками и стёртым знаком -->
  <path d="${smooth([[110, 36], [112, 24], [120, 16], [136, 16], [144, 24], [146, 36], [142, 44], [140, 52], [137, 45], [131, 42], [124, 46], [120, 41], [116, 48], [113, 42]])}" fill="url(#wax)" filter="url(#r-wax)"/>
  ${inkPath(ink([[110, 36], [112, 24], [120, 16], [136, 16], [144, 24], [146, 36], [142, 44], [140, 52]], { width: 2, taper: [0.2, 0.3], shade: 0.8, seed: 74 }))}
  <circle cx="128" cy="28" r="6.5" fill="url(#gold)" fill-opacity="0.8"/>
  <path d="M128 23 L132 31 L124 31 Z M124 27 L132 27" fill="none" stroke="${GOLD_DARK}" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M118 22 L123 29 L120 35 M137 20 L134 26" fill="none" stroke="#120504" stroke-width="0.9" stroke-opacity="0.8"/>
  <path d="${smooth([[117, 20], [124, 18], [120, 23]])}" fill="${HIGHLIGHT}" fill-opacity="0.45"/>

  ${standParts.front}
  `);
}

export const homunculus: ElementArt = { id: 'homunculus', render };
