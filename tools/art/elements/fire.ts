import {
  HIGHLIGHT,
  INK,
  defs,
  hatch,
  ink,
  inkPath,
  linear,
  radial,
  rng,
  smooth,
  svg,
  type ElementArt,
  type Pt,
} from '../lib';

/**
 * Огонь: высокое пламя над двумя скрещёнными поленьями.
 * Задачи: пламя и свечение. Пламя — несколько вложенных языков от тёмно-красного края
 * к почти белой сердцевине; контур — красная тушь, как в старинных трактатах.
 * Свечение мягко ложится на страницу вокруг.
 */

const RED_INK = '#5c1d0c';

const OUTER: Pt[] = [
  [84, 214], [66, 176], [68, 142], [80, 116], [84, 88], [98, 108], [104, 92], [114, 66], [126, 44], [133, 18],
  [142, 46], [148, 72], [158, 92], [176, 70], [184, 100], [190, 134], [184, 172], [170, 214],
];
const MIDDLE: Pt[] = [
  [96, 214], [84, 170], [88, 142], [102, 120], [108, 104], [118, 82], [131, 54], [138, 86], [148, 106], [164, 118],
  [172, 148], [166, 180], [156, 214],
];
const INNER: Pt[] = [
  [108, 214], [100, 180], [108, 154], [122, 130], [132, 100], [142, 128], [154, 150], [156, 178], [146, 214],
];

function log(from: Pt, to: Pt, radius: number, seed: number): string {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const nx = -Math.sin(angle) * radius;
  const ny = Math.cos(angle) * radius;
  const body: Pt[] = [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
  const id = `log-${seed}`;
  const random = rng(seed);
  // Трещины коры и тлеющие угли на нижней стороне полена
  const cracks = Array.from({ length: 5 }, (_, i) => {
    const t = 0.15 + i * 0.17 + random() * 0.05;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    const side = random() > 0.5 ? 1 : -1;
    return inkPath(ink([[cx + nx * 0.8 * side, cy + ny * 0.8 * side], [cx + nx * 0.1 + 3, cy + ny * 0.1], [cx - nx * 0.5 * side + 2, cy - ny * 0.5 * side]], { width: 1.3, seed: seed + i }), INK, 0.7);
  }).join('');
  const embers = [0.3, 0.55, 0.78]
    .map((t, i) => {
      const cx = x0 + (x1 - x0) * t + nx * 0.4;
      const cy = y0 + (y1 - y0) * t + ny * 0.4;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${6 + i}" ry="2.4" transform="rotate(${(angle * 180) / Math.PI} ${cx} ${cy})" fill="#ff8a2a" fill-opacity="0.85" filter="url(#wash-soft)"/>`;
    })
    .join('');
  // Торец со спилом: годичные кольца
  const end = `<ellipse cx="${x0}" cy="${y0}" rx="${radius * 0.55}" ry="${radius}" transform="rotate(${(angle * 180) / Math.PI} ${x0} ${y0})" fill="#c79a66" filter="url(#wash)"/>` +
    `<ellipse cx="${x0}" cy="${y0}" rx="${radius * 0.3}" ry="${radius * 0.55}" transform="rotate(${(angle * 180) / Math.PI} ${x0} ${y0})" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="1"/>`;
  return `<clipPath id="${id}"><path d="${smooth(body)}"/></clipPath>
    <path d="${smooth(body)}" fill="url(#bark)" filter="url(#wash)"/>
    ${hatch({ clip: id, angle: (angle * 180) / Math.PI, spacing: 3.2, width: 0.9, bounds: [Math.min(x0, x1) - radius, Math.min(y0, y1) - radius, Math.max(x0, x1) + radius, Math.max(y0, y1) + radius], seed, opacity: 0.45 })}
    ${embers}${cracks}${end}
    ${inkPath(ink(body, { width: 2.6, closed: true, shade: 0.7, seed }))}`;
}

function sparks(): string {
  const items: [Pt, number][] = [
    [[98, 48], 2.2],
    [[170, 36], 1.8],
    [[154, 14], 1.4],
    [[76, 76], 1.6],
  ];
  return items
    .map(([[x, y], r], i) => {
      const trail = ink([[x - 2, y + 12], [x + 2, y + 6], [x, y]], { width: r * 0.8, taper: [0.95, 0], shade: 0, seed: 70 + i });
      return `<path d="${trail}" fill="#f7a23e" fill-opacity="0.45"/><circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="#ffb34a" fill-opacity="0.5" filter="url(#blur-2)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff0c0"/>`;
    })
    .join('');
}

/** Контур пламени: отдельные языки красной тушью, на освещённой стороне линия теряется. */
function contour(): string {
  const strokes: Pt[][] = [
    [[133, 18], [142, 46], [148, 72], [158, 92]],
    [[176, 70], [184, 100], [190, 134], [184, 172], [176, 196]],
    [[133, 18], [126, 44], [114, 66], [106, 86]],
    [[84, 88], [80, 116], [70, 140]],
    [[158, 92], [168, 80], [176, 70]],
    [[84, 88], [94, 100], [100, 104]],
  ];
  const widths = [2.4, 3.2, 1.6, 1.6, 2, 1.4];
  return strokes
    .map((line, i) => inkPath(ink(line, { width: widths[i]!, taper: [0.15, 0.45], shade: 0.4, seed: 80 + i }), RED_INK, 0.9))
    .join('');
}

function render(): string {
  const extra = [
    radial('flame-outer', [128, 170], 130, [
      [0, '#f7a03e'],
      [0.5, '#ec6a24'],
      [0.85, '#d4441c'],
      [1, '#b8301a'],
    ]),
    radial('flame-middle', [128, 176], 100, [
      [0, '#ffd47a'],
      [0.5, '#f8a443'],
      [1, '#ef7f2c'],
    ]),
    radial('flame-inner', [130, 184], 70, [
      [0, '#fffbe8'],
      [0.45, '#ffeaa8'],
      [1, '#ffd36e'],
    ]),
    radial('fire-glow', [128, 150], 120, [
      [0, '#ffb04a', 0.7],
      [0.5, '#f59a3a', 0.3],
      [1, '#f59a3a', 0],
    ]),
    linear('bark', [0, 190], [0, 236], [
      [0, '#8c5530'],
      [0.45, '#6a3d22'],
      [1, '#3d2214'],
    ]),
    `<clipPath id="flame-clip"><path d="${smooth(OUTER)}"/></clipPath>`,
    `<mask id="flame-dark" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="url(#flame-mask-grad)"/></mask>`,
    radial('flame-mask-grad', [128, 176], 120, [
      [0, '#000'],
      [0.5, '#000'],
      [0.85, '#fff'],
    ]),
  ].join('');

  // Внутренние токи пламени — тонкие линии красной туши
  const currents: Pt[][] = [
    [[96, 190], [92, 160], [100, 134], [96, 110]],
    [[170, 188], [176, 156], [170, 128], [178, 104]],
    [[118, 120], [126, 94], [128, 70]],
  ];

  return svg(`${defs(extra)}
  <!-- Свечение на странице -->
  <ellipse cx="128" cy="150" rx="110" ry="104" fill="url(#fire-glow)" filter="url(#glow)"/>
  <ellipse cx="128" cy="214" rx="96" ry="18" fill="#ff9d42" fill-opacity="0.35" filter="url(#blur-4)"/>

  <!-- Заднее полено, пламя, переднее полено поверх основания пламени -->
  ${log([196, 198], [80, 222], 13, 101)}
  <path d="${smooth(OUTER)}" fill="url(#flame-outer)" filter="url(#wash)"/>
  ${hatch({ clip: 'flame-clip', mask: 'flame-dark', angle: -70, spacing: 4, width: 0.8, color: RED_INK, bounds: [60, 16, 196, 214], seed: 9, opacity: 0.3 })}
  <path d="${smooth(MIDDLE)}" fill="url(#flame-middle)" filter="url(#wash-soft)"/>
  <path d="${smooth(INNER)}" fill="url(#flame-inner)" filter="url(#wash-soft)"/>
  <ellipse cx="128" cy="192" rx="22" ry="16" fill="${HIGHLIGHT}" filter="url(#blur-4)"/>
  ${currents.map((line, i) => inkPath(ink(line, { width: 1.5, taper: [0.4, 0.5], shade: 0, seed: 50 + i }), RED_INK, 0.6)).join('')}
  ${contour()}
  ${log([62, 200], [186, 230], 14, 202)}
  ${sparks()}
  `);
}

export const fire: ElementArt = { id: 'fire', render };
