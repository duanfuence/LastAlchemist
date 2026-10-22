/**
 * Инструменты рисования иллюстраций элементов.
 *
 * Иллюстрации — оригинальные рисунки в технике «тушь и акварель» старинного рукописного трактата:
 * каллиграфический контур переменной толщины, прозрачные акварельные заливки с пигментным краем
 * и зерном бумаги, гравюрная штриховка в тенях, белильные блики. Каждая иллюстрация описана
 * кодом (tools/art/elements), собирается в SVG и растрируется в WebP скриптом tools/art/render.ts.
 *
 * Общие правила серии (одинаковы для всех элементов):
 * - холст 256×256, объект занимает примерно 200×220 и стоит на воображаемой поверхности;
 * - свет сверху слева (LIGHT), тени и утолщения линий — снизу справа;
 * - тушь — тёплая коричнево-чёрная (INK), блики — белила (HIGHLIGHT), золото — только у редкого.
 */

export type Pt = readonly [number, number];

export const SIZE = 256;
export const INK = '#2a1b12';
export const INK_SOFT = '#4a3424';
export const HIGHLIGHT = '#fff8e6';
/** Направление на источник света (сверху слева). */
export const LIGHT: Pt = norm([-0.62, -0.78]);

export function norm([x, y]: Pt): Pt {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

/** Детерминированный генератор случайных чисел: рисунок одинаков при каждой сборке. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Гладкая кривая Кэтмелла — Рома через опорные точки. */
export function spline(points: readonly Pt[], closed = false, perSegment = 14): Pt[] {
  const n = points.length;
  if (n < 3) return [...points];
  const at = (i: number): Pt => {
    if (closed) return points[((i % n) + n) % n]!;
    return points[Math.max(0, Math.min(n - 1, i))]!;
  };
  const out: Pt[] = [];
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(points[n - 1]!);
  return out;
}

/** Ломаная в атрибут d. */
export function polyD(points: readonly Pt[], closed = true): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M${f(first![0])} ${f(first![1])}${rest.map((p) => `L${f(p[0])} ${f(p[1])}`).join('')}${closed ? 'Z' : ''}`;
}

/** Гладкая замкнутая или открытая фигура через опорные точки. */
export function smooth(points: readonly Pt[], closed = true): string {
  return polyD(spline(points, closed), closed);
}

function signedArea(points: readonly Pt[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

export interface InkOptions {
  /** Толщина линии в середине. */
  width: number;
  /** Доля длины, на которой линия сужается к началу и концу (для открытых линий). */
  taper?: readonly [number, number];
  /** Насколько линия толще на теневой стороне (0 — одинаковая). */
  shade?: number;
  /** Неровность нажима пера, доля толщины. */
  pressure?: number;
  seed?: number;
  closed?: boolean;
  /** Опорные точки уже плотные, сглаживание не нужно. */
  raw?: boolean;
}

/**
 * Линия пера переменной толщины — заливаемый контур, а не stroke.
 * Нажим меняется плавно, концы сужаются, на теневой стороне формы линия тяжелее, как в гравюре.
 */
export function ink(points: readonly Pt[], options: InkOptions): string {
  const closed = options.closed ?? false;
  const pts = options.raw ? [...points] : spline(points, closed, 16);
  const n = pts.length;
  if (n < 2) return '';
  const random = rng(options.seed ?? 1);
  const phases = [random() * 6.28, random() * 6.28, random() * 6.28];
  const lengths = [0];
  for (let i = 1; i < n; i += 1) lengths.push(lengths[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = lengths[n - 1]! || 1;
  // Наружная нормаль для замкнутой фигуры зависит от направления обхода
  const orientation = closed && signedArea(pts) < 0 ? -1 : 1;
  const [taperStart, taperEnd] = options.taper ?? (closed ? [0, 0] : [0.25, 0.3]);
  const shade = options.shade ?? 0.6;
  const pressure = options.pressure ?? 0.12;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    const [tx, ty] = norm([next[0] - prev[0], next[1] - prev[1]]);
    const normal: Pt = [ty * orientation, -tx * orientation];
    const t = lengths[i]! / total;
    let w = options.width;
    if (taperStart > 0 && t < taperStart) w *= 0.12 + 0.88 * Math.sin(((t / taperStart) * Math.PI) / 2);
    if (taperEnd > 0 && t > 1 - taperEnd) w *= 0.12 + 0.88 * Math.sin((((1 - t) / taperEnd) * Math.PI) / 2);
    // Теневая сторона — противоположная свету
    const away = -(normal[0] * LIGHT[0] + normal[1] * LIGHT[1]);
    w *= 1 + shade * away;
    w *= 1 + pressure * (Math.sin(t * 9 + phases[0]!) * 0.6 + Math.sin(t * 23 + phases[1]!) * 0.4);
    w = Math.max(w, 0.25);
    const p = pts[i]!;
    left.push([p[0] + (normal[0] * w) / 2, p[1] + (normal[1] * w) / 2]);
    right.push([p[0] - (normal[0] * w) / 2, p[1] - (normal[1] * w) / 2]);
  }
  if (closed) return `${polyD(left)}${polyD([...right].reverse())}`;
  return polyD([...left, ...right.reverse()]);
}

/** Атрибуты заливки контура пера. */
export function inkPath(d: string, color = INK, opacity = 1): string {
  return `<path d="${d}" fill="${color}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} fill-rule="evenodd"/>`;
}

export interface HatchOptions {
  /** Область (id clipPath), внутри которой идёт штриховка. */
  clip: string;
  /** Маска плотности (id mask): штриховка видна только в тени. */
  mask?: string;
  angle: number;
  spacing: number;
  width?: number;
  color?: string;
  bounds: readonly [number, number, number, number];
  seed?: number;
  opacity?: number;
}

/** Гравюрная штриховка: параллельные линии пера с лёгкой дрожью, обрезанные формой и маской тени. */
export function hatch(options: HatchOptions): string {
  const random = rng(options.seed ?? 5);
  const [x0, y0, x1, y1] = options.bounds;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const radius = Math.hypot(x1 - x0, y1 - y0) / 2;
  const a = (options.angle * Math.PI) / 180;
  const dir: Pt = [Math.cos(a), Math.sin(a)];
  const across: Pt = [-dir[1], dir[0]];
  const lines: string[] = [];
  for (let o = -radius; o <= radius; o += options.spacing) {
    const offset = o + (random() - 0.5) * options.spacing * 0.3;
    const points: Pt[] = [];
    for (let s = -radius; s <= radius; s += radius / 4) {
      const wobble = (random() - 0.5) * options.spacing * 0.18;
      points.push([cx + across[0] * (offset + wobble) + dir[0] * s, cy + across[1] * (offset + wobble) + dir[1] * s]);
    }
    lines.push(ink(points, { width: options.width ?? 1.1, taper: [0.08, 0.08], shade: 0, pressure: 0.3, seed: Math.floor(random() * 1e6) }));
  }
  const attrs = [`clip-path="url(#${options.clip})"`, options.mask ? `mask="url(#${options.mask})"` : ''].join(' ');
  return `<g ${attrs} opacity="${options.opacity ?? 1}"><path d="${lines.join('')}" fill="${options.color ?? INK}"/></g>`;
}

/** Пунктир (стиппль): частицы, плотность которых задаёт функция density(x, y) ∈ [0, 1]. */
export function stipple(options: {
  count: number;
  bounds: readonly [number, number, number, number];
  density: (x: number, y: number) => number;
  radius: (x: number, y: number, random: () => number) => number;
  color: string | ((x: number, y: number, random: () => number) => string);
  seed?: number;
  opacity?: number;
}): string {
  const random = rng(options.seed ?? 11);
  const [x0, y0, x1, y1] = options.bounds;
  const byColor = new Map<string, string[]>();
  let placed = 0;
  let attempts = 0;
  while (placed < options.count && attempts < options.count * 40) {
    attempts += 1;
    const x = x0 + random() * (x1 - x0);
    const y = y0 + random() * (y1 - y0);
    if (random() > options.density(x, y)) continue;
    const r = options.radius(x, y, random);
    const color = typeof options.color === 'string' ? options.color : options.color(x, y, random);
    const list = byColor.get(color) ?? [];
    // Частица — маленький круг из двух дуг (одна дорожка на цвет вместо тысяч элементов)
    list.push(`M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`);
    byColor.set(color, list);
    placed += 1;
  }
  const paths = [...byColor].map(([color, list]) => `<path d="${list.join('')}" fill="${color}"/>`);
  return `<g opacity="${options.opacity ?? 1}">${paths.join('')}</g>`;
}

/**
 * Общие фильтры серии:
 * - wash — акварель: размытый край, пигмент скапливается у границы, зерно бумаги;
 * - wash-soft — то же без тёмного края (для свечения жидкостей и пламени);
 * - ink-rough — едва заметная неровность туши;
 * - glow — мягкое свечение.
 */
export function defs(extra = ''): string {
  return `<defs>
  <filter id="wash" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="4.5" xChannelSelector="R" yChannelSelector="G" result="paint"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="12" result="grainRaw"/>
    <feColorMatrix in="grainRaw" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -0.5 -0.3 0 0 1.32" result="grainAlpha"/>
    <feComposite in="paint" in2="grainAlpha" operator="in" result="grained"/>
    <feMorphology in="paint" operator="erode" radius="1.6" result="inner"/>
    <feComposite in="paint" in2="inner" operator="out" result="rim"/>
    <feGaussianBlur in="rim" stdDeviation="0.9" result="rimSoft"/>
    <feColorMatrix in="rimSoft" type="matrix" values="0.62 0 0 0 0  0 0.58 0 0 0  0 0 0.55 0 0  0 0 0 0.75 0" result="rimDark"/>
    <feComposite in="rimDark" in2="paint" operator="in" result="rimClip"/>
    <feMerge><feMergeNode in="grained"/><feMergeNode in="rimClip"/></feMerge>
  </filter>
  <filter id="wash-soft" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="8" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="paint"/>
    <feGaussianBlur in="paint" stdDeviation="0.6"/>
  </filter>
  <filter id="ink-rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="9"/>
  </filter>
  <filter id="blur-2" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation="2"/>
  </filter>
  <filter id="blur-4" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="4"/>
  </filter>
  ${extra}
</defs>`;
}

export function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${body}</svg>`;
}

/** Линейный градиент по точкам [смещение, цвет, прозрачность?]. */
export function linear(id: string, from: Pt, to: Pt, stops: readonly (readonly [number, string, number?])[]): string {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(from[0])}" y1="${f(from[1])}" x2="${f(to[0])}" y2="${f(to[1])}">${stopTags(stops)}</linearGradient>`;
}

/** Радиальный градиент с центром c, радиусом r и смещённым фокусом. */
export function radial(id: string, c: Pt, r: number, stops: readonly (readonly [number, string, number?])[], focus?: Pt): string {
  const fx = focus ? ` fx="${f(focus[0])}" fy="${f(focus[1])}"` : '';
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}"${fx}>${stopTags(stops)}</radialGradient>`;
}

function stopTags(stops: readonly (readonly [number, string, number?])[]): string {
  return stops
    .map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}"${opacity === undefined ? '' : ` stop-opacity="${opacity}"`}/>`)
    .join('');
}

/** Точки эллипса (для ряби, оснований, бликов). */
export function ellipse(c: Pt, rx: number, ry: number, count = 24, from = 0, to = Math.PI * 2): Pt[] {
  const points: Pt[] = [];
  const closed = Math.abs(to - from - Math.PI * 2) < 1e-6;
  const steps = closed ? count : count - 1;
  for (let i = 0; i < count; i += 1) {
    const a = from + ((to - from) * i) / steps;
    points.push([c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry]);
  }
  return points;
}

export interface ElementArt {
  id: string;
  render(): string;
}
