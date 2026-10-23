import {
  HIGHLIGHT,
  INK,
  defs,
  edge,
  ink,
  inkPath,
  linear,
  radial,
  relief,
  rng,
  smooth,
  speck,
  stipple,
  svg,
  type ElementArt,
  type Pt,
} from '../lib';

/**
 * Огонь: живое пламя над двумя обугленными поленьями.
 * Пламя собрано из отдельных языков, а не из одного силуэта: тёмно-красные кончики,
 * оранжевая середина, почти белая сердцевина и синеватый корень у самого дерева.
 * Края языков мягкие (у огня нет контура), один язык оторвался и гаснет вверху.
 * Поленья — настоящее дерево: волокна коры в рельефе, сверху их освещает само пламя,
 * в трещинах тлеет жар, торцы показывают годичные кольца. Под ними лежат угли.
 */

const RED_INK = '#3e1206';

/** Язык пламени: основание шириной w, высота h, кончик смещён на lean. */
function tongue(cx: number, by: number, w: number, h: number, lean: number): Pt[] {
  return [
    [cx - w / 2, by],
    [cx - w * 0.56 + lean * 0.15, by - h * 0.28],
    [cx - w * 0.34 + lean * 0.45, by - h * 0.56],
    [cx - w * 0.08 + lean * 0.85, by - h * 0.84],
    [cx + lean, by - h],
    [cx + w * 0.1 + lean * 0.75, by - h * 0.8],
    [cx + w * 0.34 + lean * 0.42, by - h * 0.52],
    [cx + w * 0.55 + lean * 0.12, by - h * 0.26],
    [cx + w / 2, by],
  ];
}

const BASE = 196;
const TONGUES: readonly [number, number, number, number][] = [
  // cx, ширина, высота, наклон
  [128, 78, 176, -6],
  [100, 50, 118, -16],
  [158, 54, 134, 14],
  [80, 30, 74, -12],
  [180, 32, 84, 10],
];

function flameLayer(scale: number, fill: string, filter: string, opacity = 1): string {
  const d = TONGUES.map(([cx, w, h, lean]) => smooth(tongue(cx, BASE, w * scale, h * (0.35 + scale * 0.65), lean * scale))).join('');
  return `<path d="${d}" fill="${fill}" filter="url(#${filter})" opacity="${opacity}"/>`;
}

/** Полено: кора в рельефе, освещённая пламенем сверху, тлеющие трещины, торец с кольцами. */
function log(from: Pt, to: Pt, radius: number, seed: number, glowSide: number): string {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const deg = (angle * 180) / Math.PI;
  const nx = -Math.sin(angle) * radius;
  const ny = Math.cos(angle) * radius;
  const random = rng(seed);
  // Неровный край коры
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    const bump = 1 + (random() - 0.5) * 0.16;
    top.push([x0 + (x1 - x0) * t - nx * bump, y0 + (y1 - y0) * t - ny * bump]);
    bottom.push([x0 + (x1 - x0) * t + nx * bump, y0 + (y1 - y0) * t + ny * bump]);
  }
  const d = smooth([...top, [x1 + Math.cos(angle) * radius * 0.35, y1 + Math.sin(angle) * radius * 0.35], ...bottom.reverse()]);
  const clip = `log-${seed}`;
  // Обугленная кора трескается «чешуёй»: продольные разломы и короткие поперечные.
  // Жар светится в трещинах на стороне, обращённой к огню (glowSide — доля длины)
  const along: Pt = [Math.cos(angle), Math.sin(angle)];
  const length = Math.hypot(x1 - x0, y1 - y0);
  const cracks = Array.from({ length: 26 }, (_, i) => {
    const t = 0.06 + random() * 0.9;
    const v = (random() - 0.5) * 1.6;
    const cx = x0 + (x1 - x0) * t + nx * v * 0.6;
    const cy = y0 + (y1 - y0) * t + ny * v * 0.6;
    const transverse = i % 3 === 0;
    const len = transverse ? radius * (0.5 + random() * 0.6) : length * (0.06 + random() * 0.1);
    const dir: Pt = transverse ? [nx / radius, ny / radius] : along;
    const line: Pt[] = [
      [cx - dir[0] * len * 0.5, cy - dir[1] * len * 0.5],
      [cx + (random() - 0.5) * 2, cy + (random() - 0.5) * 2],
      [cx + dir[0] * len * 0.5, cy + dir[1] * len * 0.5],
    ];
    const heat = Math.max(0, 1 - Math.abs(t - glowSide) * 2.2) * (random() > 0.35 ? 1 : 0.2);
    const path = ink(line, { width: 1.1 + heat * 1.2, taper: [0.35, 0.35], shade: 0, pressure: 0.5, seed: seed + i });
    return `<path d="${path}" fill="#070302" fill-opacity="0.85"/>` +
      (heat > 0.2 ? `<path d="${path}" fill="#ff6a16" fill-opacity="${(0.35 + heat * 0.55).toFixed(2)}" filter="url(#ember-glow)"/><path d="${ink(line, { width: 0.5 + heat * 0.8, taper: [0.4, 0.4], shade: 0, seed: seed + i })}" fill="#ffc96a" fill-opacity="${(heat * 0.9).toFixed(2)}"/>` : '');
  }).join('');
  // Торец: светлая древесина, кольца, обугленный край
  const ring = (k: number, color: string, opacity: number): string =>
    `<ellipse cx="${x0}" cy="${y0}" rx="${radius * 0.5 * k}" ry="${radius * 0.95 * k}" transform="rotate(${deg} ${x0} ${y0})" fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="0.9"/>`;
  const end = `<ellipse cx="${x0}" cy="${y0}" rx="${radius * 0.55}" ry="${radius * 1.02}" transform="rotate(${deg} ${x0} ${y0})" fill="#1a0e08"/>
    <ellipse cx="${x0}" cy="${y0}" rx="${radius * 0.44}" ry="${radius * 0.84}" transform="rotate(${deg} ${x0} ${y0})" fill="#65412a" filter="url(#r-end)"/>
    ${ring(0.62, '#3a2213', 0.7)}${ring(0.36, '#3a2213', 0.6)}${ring(0.82, '#ff8a30', 0.5)}`;
  return `<clipPath id="${clip}"><path d="${d}"/></clipPath>
    <path d="${d}" fill="url(#bark)" filter="url(#r-bark)"/>
    <g clip-path="url(#${clip})">
      ${cracks}
      <path d="${d}" fill="#000" filter="url(#fire-lit)"/>
    </g>
    ${end}
    ${inkPath(ink([...bottom], { width: 2.2, shade: 0.4, seed }), INK, 0.85)}`;
}

function render(): string {
  const extra = [
    radial('fire-glow', [128, 140], 120, [
      [0, '#ff9a3c', 0.5],
      [0.4, '#e3631f', 0.2],
      [1, '#e3631f', 0],
    ]),
    linear('flame-outer', [0, 200], [0, 20], [
      [0, '#ff9a34'],
      [0.35, '#e8571a'],
      [0.75, '#a8240c'],
      [1, '#5e1206'],
    ]),
    linear('flame-middle', [0, 200], [0, 40], [
      [0, '#ffe08a'],
      [0.4, '#ffae46'],
      [1, '#f0752a'],
    ]),
    linear('flame-core', [0, 198], [0, 90], [
      [0, '#fffbe6'],
      [0.6, '#fff1b8'],
      [1, '#ffd977'],
    ]),
    linear('bark', [0, 182], [0, 238], [
      [0, '#7d5639'],
      [0.45, '#43291b'],
      [1, '#160d08'],
    ]),
    `<filter id="flame-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" seed="5" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="9" xChannelSelector="R" yChannelSelector="G" result="licked"/>
      <feGaussianBlur in="licked" stdDeviation="1.4"/>
    </filter>`,
    `<filter id="flame-core-soft" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03 0.06" numOctaves="2" seed="9" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="7" xChannelSelector="R" yChannelSelector="G" result="licked"/>
      <feGaussianBlur in="licked" stdDeviation="3"/>
    </filter>`,
    `<filter id="ember-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter>`,
    relief('r-bark', { frequency: '0.05 0.42', octaves: 3, roughness: 1, dome: 3, depth: 20, gloss: 0.4, sharpness: 6, strength: 1, seed: 21 }),
    relief('r-end', { frequency: 0.12, octaves: 2, roughness: 0.5, dome: 2, depth: 3, strength: 0.6, seed: 22 }),
    // Поленья освещены пламенем сверху: тёплая полоса по верхнему краю
    edge('fire-lit', { dx: 0, dy: 5, blur: 2, color: '#ff8c34', opacity: 0.55 }),
  ].join('');

  // Внутренние токи — тёмные струи в наружном пламени
  const currents: Pt[][] = [
    [[104, 186], [98, 158], [104, 132], [98, 112]],
    [[160, 184], [166, 152], [160, 126], [168, 98]],
    [[124, 140], [130, 104], [126, 70]],
  ];
  // Оторвавшийся язык: гаснет вверху
  const lick = (cx: number, cy: number, s: number): string =>
    `<path d="${smooth([[cx, cy - 14 * s], [cx + 5 * s, cy - 2 * s], [cx + 3 * s, cy + 6 * s], [cx - 3 * s, cy + 6 * s], [cx - 5 * s, cy - 2 * s]])}" fill="url(#flame-outer)" filter="url(#flame-soft)" opacity="0.85"/>`;

  return svg(`${defs(extra)}
  <!-- Отсвет пламени на странице и на столе -->
  <ellipse cx="128" cy="140" rx="112" ry="104" fill="url(#fire-glow)" filter="url(#glow)"/>
  <ellipse cx="128" cy="222" rx="96" ry="15" fill="#0b0705" fill-opacity="0.5" filter="url(#blur-4)"/>
  <ellipse cx="124" cy="216" rx="70" ry="10" fill="#ff8a32" fill-opacity="0.35" filter="url(#blur-4)"/>

  <!-- Зола и угли под поленьями -->
  <ellipse cx="130" cy="216" rx="82" ry="11" fill="#5b524b" fill-opacity="0.75" filter="url(#wash)"/>
  <ellipse cx="128" cy="214" rx="64" ry="8.5" fill="#1a0d07"/>
  ${stipple({
    count: 160,
    bounds: [64, 204, 192, 224],
    density: (x, y) => Math.max(0, 1 - ((x - 128) / 64) ** 2 - ((y - 214) / 10) ** 2),
    radius: (_x, _y, r) => 0.6 + r() * 1.4,
    color: (_x, _y, r) => (r() > 0.55 ? '#ff7a1e' : r() > 0.3 ? '#ffc35a' : '#2a1209'),
    seed: 31,
  })}

  <!-- Заднее полено, пламя, переднее полено поверх корня пламени -->
  ${log([200, 194], [78, 214], 12, 101, 0.55)}
  ${flameLayer(1, 'url(#flame-outer)', 'flame-soft', 0.96)}
  ${currents.map((line, i) => inkPath(ink(line, { width: 1.6, taper: [0.4, 0.5], shade: 0, seed: 50 + i }), RED_INK, 0.35)).join('')}
  ${flameLayer(0.7, 'url(#flame-middle)', 'flame-soft')}
  ${flameLayer(0.42, 'url(#flame-core)', 'flame-core-soft')}
  <!-- Синеватый корень пламени у самого дерева -->
  <ellipse cx="128" cy="194" rx="22" ry="4" fill="#6d8cc4" fill-opacity="0.3" filter="url(#blur-2)"/>
  <ellipse cx="128" cy="186" rx="20" ry="14" fill="${HIGHLIGHT}" fill-opacity="0.85" filter="url(#blur-4)"/>
  ${lick(122, 26, 1)}
  ${lick(170, 52, 0.7)}
  ${log([58, 200], [190, 226], 13, 202, 0.45)}

  <!-- Искры поднимаются над пламенем -->
  ${speck(98, 44, 1.6, '#ffb34a', '#fff0c0')}
  ${speck(176, 30, 1.2, '#ffb34a', '#fff0c0')}
  ${speck(146, 16, 0.9, '#ff9a3c', '#ffe2a0', 0.4)}
  ${speck(70, 88, 1, '#ff9a3c', '#ffe2a0', 0.4)}
  `);
}

export const fire: ElementArt = { id: 'fire', render };
