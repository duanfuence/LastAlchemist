/**
 * Общие детали иллюстраций: облака, кристаллы, камни, горки, листья.
 * Каждая деталь повторяет правила серии из lib.ts: свет свечи сверху слева,
 * холодная тень снизу справа, контур пера плотнее в тени. Детали параметризованы —
 * облако дождя и грозовая туча, кристаллы соли и серы различаются формой и материалом,
 * а не только цветом.
 */
import { HIGHLIGHT, INK, ink, inkPath, norm, polyD, rng, smooth, type Pt } from './lib';

const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Радиальный градиент в долях фигуры: подходит для множества одинаково освещённых форм. */
export function radialBox(id: string, cx: number, cy: number, r: number, stops: readonly (readonly [number, string, number?])[]): string {
  return `<radialGradient id="${id}" gradientUnits="objectBoundingBox" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`)
    .join('')}</radialGradient>`;
}

/** Линейный градиент в долях фигуры. */
export function linearBox(id: string, from: Pt, to: Pt, stops: readonly (readonly [number, string, number?])[]): string {
  return `<linearGradient id="${id}" gradientUnits="objectBoundingBox" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}">${stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`)
    .join('')}</linearGradient>`;
}

/** Окружность как путь (для объединения нескольких кругов в одну форму). */
export function circleD(x: number, y: number, r: number): string {
  return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

export interface CloudPalette {
  /** Освещённая свечой вершина клуба. */
  light: string;
  /** Тело облака. */
  body: string;
  /** Тёмное брюхо. */
  dark: string;
}

/**
 * Кучевое облако из клубов. Силуэт — объединение кругов с общим градиентом
 * (светлая вершина, тёмное брюхо); каждый клуб выделяется не контуром, а мягким
 * светом сверху слева и тенью от соседнего клуба. Снизу облако срезано ровнее.
 * Нужны определения cloudDefs(id) и CLOUD_SOFT.
 */
export function cloud(id: string, puffs: readonly (readonly [number, number, number])[], bottom: number): string {
  const union = puffs.map(([x, y, r]) => circleD(x, y, r)).join('');
  const billows = puffs
    .map(([x, y, r]) => `<circle cx="${f(x + r * 0.22)}" cy="${f(y + r * 0.42)}" r="${f(r * 0.78)}" fill="url(#${id}-shadow)"/>` +
      `<ellipse cx="${f(x - r * 0.18)}" cy="${f(y - r * 0.28)}" rx="${f(r * 0.72)}" ry="${f(r * 0.58)}" fill="url(#${id}-light)"/>`)
    .join('');
  return `<clipPath id="${id}-clip"><rect x="0" y="0" width="256" height="${f(bottom)}"/></clipPath>
    <clipPath id="${id}-shape"><path d="${union}"/></clipPath>
    <g clip-path="url(#${id}-clip)">
      <path d="${union}" fill="url(#${id}-body)" filter="url(#cloud-soft)"/>
      <g clip-path="url(#${id}-shape)" filter="url(#blur-2)">${billows}</g>
      <path d="${union}" fill="#000" filter="url(#cloud-belly-${id})"/>
      <path d="${union}" fill="#000" filter="url(#rim-warm)"/>
    </g>`;
}

/** Градиенты и фильтры облака заданной палитры. */
export function cloudDefs(id: string, palette: CloudPalette): string {
  return linearBox(`${id}-body`, [0.3, 0], [0.6, 1], [
    [0, palette.light],
    [0.5, palette.body],
    [1, palette.dark],
  ]) +
    radialBox(`${id}-light`, 0.5, 0.5, 0.5, [
      [0, palette.light, 0.75],
      [0.6, palette.light, 0.25],
      [1, palette.light, 0],
    ]) +
    radialBox(`${id}-shadow`, 0.5, 0.5, 0.5, [
      [0, palette.dark, 0.5],
      [0.6, palette.dark, 0.18],
      [1, palette.dark, 0],
    ]) +
    `<filter id="cloud-belly-${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feOffset in="SourceAlpha" dx="0" dy="-14" result="up"/>
      <feComposite in="SourceAlpha" in2="up" operator="out" result="band"/>
      <feGaussianBlur in="band" stdDeviation="7" result="soft"/>
      <feComposite in="soft" in2="SourceAlpha" operator="in" result="inside"/>
      <feFlood flood-color="${palette.dark}" flood-opacity="0.75"/>
      <feComposite in2="inside" operator="in"/>
    </filter>`;
}

/** Фильтр мягкого края облака (один на рисунок). */
export const CLOUD_SOFT = `<filter id="cloud-soft" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="17" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="7" xChannelSelector="R" yChannelSelector="G" result="wavy"/>
  <feGaussianBlur in="wavy" stdDeviation="1.1"/>
</filter>`;

export interface FacetPalette {
  light: string;
  mid: string;
  dark: string;
  /** Цвет рёбер (светлые грани ловят свечу). */
  edge: string;
}

/**
 * Кристалл-призма с заострённой вершиной: три видимые грани и три грани вершины.
 * Освещённая левая грань светлая, правая уходит в тень. base — середина основания.
 */
export function crystal(base: Pt, height: number, width: number, tilt: number, palette: FacetPalette, seed: number, opacity = 1): string {
  const a = (tilt * Math.PI) / 180;
  const up: Pt = [Math.sin(a), -Math.cos(a)];
  const side: Pt = [Math.cos(a), Math.sin(a)];
  const at = (u: number, s: number): Pt => [base[0] + up[0] * u + side[0] * s, base[1] + up[1] * u + side[1] * s];
  const body = height * 0.72;
  const hw = width / 2;
  const l0 = at(0, -hw);
  const c0 = at(-width * 0.12, -hw * 0.15);
  const r0 = at(0, hw);
  const l1 = at(body, -hw);
  const c1 = at(body - width * 0.12, -hw * 0.15);
  const r1 = at(body, hw);
  const tip = at(height, -hw * 0.05);
  const faces = [
    { pts: [l0, c0, c1, l1], fill: palette.light },
    { pts: [c0, r0, r1, c1], fill: palette.mid },
    { pts: [l1, c1, tip], fill: palette.light },
    { pts: [c1, r1, tip], fill: palette.dark },
  ];
  const random = rng(seed);
  // Внутренние трещины и включения: кристалл не стерильный
  const flaw = at(body * (0.3 + random() * 0.3), -hw * 0.4);
  return `<g opacity="${opacity}">${faces.map((face) => `<path d="${polyD(face.pts)}" fill="${face.fill}"/>`).join('')}
    <path d="${polyD([c0, r0, r1, c1])}" fill="url(#facet-shade)"/>
    <path d="M${f(flaw[0])} ${f(flaw[1])} l${f(width * 0.18)} ${f(-height * 0.08)}" stroke="${palette.edge}" stroke-opacity="0.5" stroke-width="0.7"/>
    <path d="M${f(l0[0])} ${f(l0[1])}L${f(l1[0])} ${f(l1[1])}L${f(tip[0])} ${f(tip[1])}" fill="none" stroke="${palette.edge}" stroke-width="0.9" stroke-opacity="0.85"/>
    <path d="M${f(c0[0])} ${f(c0[1])}L${f(c1[0])} ${f(c1[1])}L${f(tip[0])} ${f(tip[1])}" fill="none" stroke="${HIGHLIGHT}" stroke-width="0.7" stroke-opacity="0.55"/>
    ${inkPath(ink([l0, l1, tip, r1, r0], { width: 1.1, taper: [0.1, 0.1], shade: 0.9, seed, raw: true }), INK, 0.75)}</g>`;
}

/** Градиент затемнения правой грани кристалла к основанию (общий). */
export const FACET_SHADE = linearBox('facet-shade', [0.5, 0], [0.5, 1], [
  [0, '#000', 0],
  [1, '#0b1416', 0.4],
]);

/** Неровный валун или ком: точки по кругу с шумом радиуса и плоским низом. */
export function lump(c: Pt, rx: number, ry: number, seed: number, flat = 0.75, jitter = 0.12, count = 14): Pt[] {
  const random = rng(seed);
  const points: Pt[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const k = 1 + (random() - 0.5) * 2 * jitter;
    let y = c[1] + Math.sin(a) * ry * k;
    if (Math.sin(a) > flat) y = c[1] + ry * flat + (Math.sin(a) - flat) * ry * 0.25;
    points.push([c[0] + Math.cos(a) * rx * k, y]);
  }
  return points;
}

/** Горка сыпучего: широкое основание, скруглённая вершина, неровный склон. */
export function mound(cx: number, by: number, w: number, h: number, seed: number, peak = 0): Pt[] {
  const random = rng(seed);
  const points: Pt[] = [];
  const n = 11;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const x = cx - w / 2 + w * t;
    const s = Math.sin(Math.PI * Math.pow(t, 1 + peak * 0.3));
    const y = by - h * Math.pow(s, 1.4) + (i > 0 && i < n ? (random() - 0.5) * h * 0.08 : 0);
    points.push([x, y]);
  }
  points.push([cx + w * 0.3, by + 3], [cx - w * 0.3, by + 3]);
  return points;
}

/** Лист с черешком: основание, кончик, ширина и изгиб; возвращает контур и центральную жилку. */
export function leaf(base: Pt, tip: Pt, width: number, bend = 0): { outline: Pt[]; rib: Pt[] } {
  const dx = tip[0] - base[0];
  const dy = tip[1] - base[1];
  const n = norm([-dy, dx]);
  const at = (t: number, s: number): Pt => [
    base[0] + dx * t + n[0] * (s + bend * Math.sin(Math.PI * t)),
    base[1] + dy * t + n[1] * (s + bend * Math.sin(Math.PI * t)),
  ];
  const w = width / 2;
  return {
    outline: [at(0, 0), at(0.2, w * 0.75), at(0.5, w), at(0.8, w * 0.6), at(1, 0), at(0.8, -w * 0.55), at(0.5, -w * 0.95), at(0.2, -w * 0.7)],
    rib: [at(0.02, 0), at(0.5, 0), at(0.95, 0)],
  };
}

/** Нарисованный лист: заливка с градиентом, жилки, контур. */
export function drawLeaf(base: Pt, tip: Pt, width: number, bend: number, fill: string, seed: number): string {
  const { outline, rib } = leaf(base, tip, width, bend);
  const d = smooth(outline);
  const veins = [0.3, 0.5, 0.7]
    .map((t, i) => {
      const p = rib[1]!;
      const q: Pt = [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t];
      const o = leaf(base, tip, width * 0.8, bend).outline;
      return inkPath(ink([[q[0] * 0.5 + p[0] * 0.5, q[1] * 0.5 + p[1] * 0.5], o[i + 1]!], { width: 0.5, taper: [0.2, 0.6], shade: 0, seed: seed + i }), INK, 0.3) +
        inkPath(ink([[q[0] * 0.5 + p[0] * 0.5, q[1] * 0.5 + p[1] * 0.5], o[7 - i]!], { width: 0.5, taper: [0.2, 0.6], shade: 0, seed: seed + 5 + i }), INK, 0.3);
    })
    .join('');
  return `<path d="${d}" fill="${fill}"/>
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm-thin)"/>
    ${veins}
    ${inkPath(ink(rib, { width: 0.9, taper: [0.1, 0.7], shade: 0, seed: seed + 9 }), INK, 0.45)}
    ${inkPath(ink(outline, { width: 1.1, closed: true, shade: 1, seed }), INK, 0.8)}`;
}

/** Капли дождя: короткие косые штрихи, наклон по ветру. */
export function rainStreaks(bounds: readonly [number, number, number, number], count: number, slant: number, seed: number, color: string, opacity: number): string {
  const random = rng(seed);
  const [x0, y0, x1, y1] = bounds;
  const lines: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = x0 + random() * (x1 - x0);
    const y = y0 + random() * (y1 - y0);
    const len = 10 + random() * 12;
    lines.push(ink([[x, y], [x + slant * len, y + len]], { width: 1.4 + random() * 0.8, taper: [0.7, 0.15], shade: 0, seed: seed + i }));
  }
  return `<path d="${lines.join('')}" fill="${color}" fill-opacity="${opacity}"/>`;
}
