import {
  CANDLE,
  HIGHLIGHT,
  INK,
  defs,
  groundShadow,
  ink,
  inkPath,
  linear,
  relief,
  rng,
  smooth,
  stipple,
  svg,
  type ElementArt,
  type Pt,
} from '../lib';

/**
 * Пыль (воздух + земля): вихрь мельчайших частиц, поднятый с горки сухой земли,
 * в косом луче света. Задачи: мелкие частицы и сложная фактура.
 * Частицы расставлены по спирали вихря: задние — мельче и бледнее, передние — крупнее,
 * в луче света частицы вспыхивают светлыми точками.
 */

const BASE_Y = 202;
const TOP_Y = 40;

/** Ось вихря слегка изгибается, радиус растёт кверху. */
function axis(t: number): { x: number; y: number; r: number } {
  return {
    x: 128 + Math.sin(t * 2.6 + 0.4) * 14 - t * 6,
    y: BASE_Y - (BASE_Y - TOP_Y) * t,
    r: 9 + 74 * Math.pow(t, 0.85),
  };
}

/** Луч света: полоса сверху слева вниз направо. */
function inBeam(x: number, y: number): number {
  // Расстояние до центральной линии луча
  const d = Math.abs((y - 30) - (x - 40) * 0.95) / Math.hypot(1, 0.95);
  return Math.max(0, 1 - d / 34);
}

interface Grain {
  x: number;
  y: number;
  r: number;
  color: string;
  front: boolean;
}

function grains(): Grain[] {
  const random = rng(17);
  const list: Grain[] = [];
  const turns = 3.2;
  for (let i = 0; i < 3400; i += 1) {
    const band = Math.floor(random() * 3);
    const t = Math.pow(random(), 0.9);
    const { x, y, r } = axis(t);
    const theta = t * turns * Math.PI * 2 + band * 2.1 + (random() - 0.5) * 1.1;
    const spread = 1 + (random() - 0.5) * 0.35;
    const gx = x + Math.cos(theta) * r * spread + (random() - 0.5) * 6;
    const gy = y + Math.sin(theta) * r * 0.22 * spread + (random() - 0.5) * 8 * (0.4 + t);
    const front = Math.sin(theta) > 0;
    const beam = inBeam(gx, gy);
    let size = (0.35 + random() * random() * 1.5) * (front ? 1.15 : 0.75) * (0.7 + t * 0.5);
    let color: string;
    if (beam > 0.25 && random() < beam) {
      color = random() < 0.5 ? HIGHLIGHT : CANDLE;
      size *= 1.1;
    } else if (front) {
      color = random() < 0.6 ? '#22160d' : '#4a3424';
    } else {
      color = random() < 0.5 ? '#585a52' : '#77736a';
    }
    list.push({ x: gx, y: gy, r: size, color, front });
  }
  // Редкие крупные песчинки у основания
  for (let i = 0; i < 26; i += 1) {
    const t = random() * 0.35;
    const { x, y, r } = axis(t);
    const theta = random() * Math.PI * 2;
    list.push({ x: x + Math.cos(theta) * r * 1.1, y: y + Math.sin(theta) * r * 0.25 - random() * 6, r: 1.4 + random() * 1.6, color: '#3a2a1c', front: true });
  }
  return list;
}

function grainPaths(list: Grain[]): { back: string; front: string } {
  const groups = new Map<string, string[]>();
  for (const g of list) {
    const key = `${g.color}|${g.front ? 1 : 0}`;
    const r = g.r;
    const d = `M${(g.x - r).toFixed(1)} ${g.y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const back = [...groups].filter(([key]) => key.endsWith('|0'));
  const front = [...groups].filter(([key]) => key.endsWith('|1'));
  const paths = (entries: [string, string[]][], opacity: number): string =>
    entries.map(([key, ds]) => `<path d="${ds.join('')}" fill="${key.split('|')[0]}" fill-opacity="${opacity}"/>`).join('');
  return { back: paths(back, 0.7), front: paths(front, 0.95) };
}

/** Линии движения: спиральные росчерки пера вдоль вихря. */
function swirls(front: boolean): string {
  const strokes: string[] = [];
  const random = rng(front ? 5 : 6);
  const bands = front ? 4 : 2;
  for (let band = 0; band < bands; band += 1) {
    const start = 0.18 + band * (front ? 0.2 : 0.35) + random() * 0.06;
    const steps = 5 + Math.floor(random() * 3);
    const points: Pt[] = [];
    for (let k = 0; k <= steps; k += 1) {
      const t = start + k * 0.014;
      if (t > 1) break;
      const { x, y, r } = axis(t);
      const theta = (front ? 0.3 + random() * 0.4 : Math.PI + 0.4) + k * 0.3 + band * 1.7;
      points.push([x + Math.cos(theta) * r, y + Math.sin(theta) * r * 0.22]);
    }
    if (points.length > 3) {
      strokes.push(inkPath(ink(points, { width: front ? 1.9 - band * 0.2 : 1.1, taper: [0.45, 0.5], shade: 0, seed: 40 + band + (front ? 0 : 10) }), front ? INK : '#3e4440', front ? 0.65 : 0.4));
    }
  }
  return strokes.join('');
}

/** Камешки на горке земли. */
function pebbles(): string {
  const items: [number, number, number][] = [[86, 218, 2.6], [160, 214, 3], [184, 224, 2.2], [120, 226, 1.8]];
  return items
    .map(([x, y, r], i) => {
      const shape: Pt[] = [[x - r, y], [x - r * 0.4, y - r * 0.8], [x + r * 0.6, y - r * 0.7], [x + r, y + r * 0.1], [x + r * 0.3, y + r * 0.7], [x - r * 0.6, y + r * 0.6]];
      return `<path d="${smooth(shape)}" fill="${i % 2 ? '#7a6650' : '#8a7860'}" filter="url(#r-pebble)"/>` +
        inkPath(ink(shape, { width: 0.9, closed: true, shade: 1, seed: 90 + i }), INK, 0.8);
    })
    .join('');
}

function render(): string {
  const heap: Pt[] = [[52, 224], [72, 210], [96, 199], [122, 193], [148, 195], [172, 203], [196, 214], [210, 225], [176, 231], [128, 233], [80, 231]];
  const extra = [
    linear('heap', [90, 192], [170, 234], [
      [0, '#93805f'],
      [0.5, '#5e4a35'],
      [1, '#2c2015'],
    ]),
    relief('r-soil', { frequency: 0.16, octaves: 3, roughness: 1, dome: 7, depth: 14, gloss: 0.05, strength: 1, seed: 51 }),
    relief('r-pebble', { frequency: 0.2, octaves: 2, roughness: 0.4, dome: 1.6, depth: 5, gloss: 0.35, sharpness: 12, seed: 52 }),
    linear('beam', [40, 30], [220, 200], [
      [0, CANDLE, 0],
      [0.25, CANDLE, 0.38],
      [0.6, CANDLE, 0.2],
      [1, CANDLE, 0],
    ]),
  ].join('');
  const groups = grainPaths(grains());

  // Объём вихря: клубы пыли вдоль спирали, неровные, как размытая акварель
  const puffRandom = rng(23);
  const clouds = Array.from({ length: 16 }, (_, i) => {
    const t = 0.06 + (i / 16) * 0.9 + puffRandom() * 0.04;
    const { x, y, r } = axis(t);
    const theta = t * 3.2 * Math.PI * 2 + puffRandom() * 2;
    const cx = x + Math.cos(theta) * r * 0.55;
    const cy = y + Math.sin(theta) * r * 0.15;
    const rx = r * (0.45 + puffRandom() * 0.3) + 6;
    const color = puffRandom() < 0.5 ? '#5e5244' : '#6f685a';
    return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 0.42).toFixed(1)}" fill="${color}" fill-opacity="${(0.24 - t * 0.1).toFixed(2)}" filter="url(#blur-4)"/>`;
  }).join('');
  // Тень вихря внизу справа
  const shade = [0.2, 0.5, 0.8]
    .map((t) => {
      const { x, y, r } = axis(t);
      return `<ellipse cx="${(x + r * 0.45).toFixed(1)}" cy="${(y + 4).toFixed(1)}" rx="${(r * 0.55).toFixed(1)}" ry="${(r * 0.18 + 5).toFixed(1)}" fill="#1f2e2c" fill-opacity="0.32" filter="url(#wash-soft)"/>`;
    })
    .join('');

  return svg(`${defs(extra)}
  ${groundShadow(134, 231, 84, 8)}
  <!-- Горка сухой земли: комковатый рельеф, тёплая кромка к свету -->
  <path d="${smooth(heap)}" fill="url(#heap)" filter="url(#r-soil)"/>
  <path d="${smooth(heap)}" fill="#000" filter="url(#rim-warm)"/>
  <clipPath id="heap-clip"><path d="${smooth(heap)}"/></clipPath>
  <g clip-path="url(#heap-clip)">${stipple({
    count: 600,
    bounds: [48, 188, 214, 236],
    density: (x) => 0.35 + Math.max(0, (x - 110) / 110) * 0.65,
    radius: (_x, _y, random) => 0.4 + random() * 0.9,
    color: (x, _y, random) => (random() < (x - 60) / 160 ? '#1e140c' : '#a8936f'),
    seed: 31,
  })}</g>
  ${pebbles()}
  ${inkPath(ink([[52, 224], [72, 210], [92, 200]], { width: 2.4, taper: [0.2, 0.4], shade: 0.6, seed: 2 }))}
  ${inkPath(ink([[150, 196], [172, 203], [196, 214], [210, 225]], { width: 2.6, taper: [0.4, 0.2], shade: 0.6, seed: 4 }))}
  ${inkPath(ink([[60, 229], [100, 233], [150, 233], [204, 228]], { width: 1.8, taper: [0.25, 0.25], shade: 0.4, seed: 3 }), INK, 0.8)}

  <!-- Вихрь: задняя половина, облако, луч, передняя половина -->
  ${groups.back}
  ${swirls(false)}
  ${clouds}
  ${shade}
  <path d="M10 6 L64 6 L250 196 L250 238 Z" fill="url(#beam)" filter="url(#blur-4)"/>
  ${groups.front}
  ${swirls(true)}
  `);
}

export const dust: ElementArt = { id: 'dust', render };
