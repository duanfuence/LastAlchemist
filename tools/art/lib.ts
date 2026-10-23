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
 * - светотень тёмной лаборатории: тёплый свет свечи сверху слева (LIGHT, CANDLE),
 *   холодные серо-зелёные тени снизу справа (COLD, coldShade), утолщения линий — в тени;
 * - на блестящих поверхностях отражается пламя свечи (candleReflection), а не окно;
 * - тушь — почти чёрная коричневая (INK), золото — только у редкого и потускневшее.
 */

export type Pt = readonly [number, number];

export const SIZE = 256;
export const INK = '#1c120b';
export const INK_SOFT = '#3e2b1d';
export const HIGHLIGHT = '#fff3dc';
/** Тёплый свет свечи — единственный источник света в лаборатории. */
export const CANDLE = '#ffe2b0';
/** Холодный тон теней: сырой камень подземелья. */
export const COLD = '#1d3634';
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
  <filter id="blur-1" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="1"/>
  </filter>
  <filter id="blur-8" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="8"/>
  </filter>
  ${edge('rim-warm', { dx: 3.5, dy: 4.5, blur: 1.8, color: CANDLE, opacity: 0.5 })}
  ${edge('rim-warm-thin', { dx: 1.6, dy: 2, blur: 0.8, color: HIGHLIGHT, opacity: 0.6 })}
  ${edge('core-cold', { dx: -9, dy: -11, blur: 6, color: COLD, opacity: 0.55 })}
  ${edge('core-dark', { dx: -6, dy: -8, blur: 4, color: '#0d0907', opacity: 0.5 })}
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

/**
 * Холодная тень формы: от прозрачного у света к холодному тону в тени, внутри силуэта (clipId).
 * Объединяет серию одной светотенью: тёплый свет свечи и холодный сумрак подземелья.
 */
export function coldShade(id: string, clipId: string, from: Pt, to: Pt, opacity = 0.55): string {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(from[0])}" y1="${f(from[1])}" x2="${f(to[0])}" y2="${f(to[1])}">
      <stop offset="0" stop-color="${COLD}" stop-opacity="0"/><stop offset="0.55" stop-color="${COLD}" stop-opacity="${opacity * 0.4}"/><stop offset="1" stop-color="${COLD}" stop-opacity="${opacity}"/>
    </linearGradient>
    <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#${id})" clip-path="url(#${clipId})"/>`;
}

/** Отражение пламени свечи на блестящей поверхности: маленький язычок и тёплый ореол. */
export function candleReflection(x: number, y: number, size: number, opacity = 1): string {
  const flame: Pt[] = [
    [x, y - size * 1.25],
    [x + size * 0.42, y - size * 0.1],
    [x + size * 0.3, y + size * 0.55],
    [x, y + size * 0.7],
    [x - size * 0.3, y + size * 0.55],
    [x - size * 0.42, y - size * 0.1],
  ];
  return `<g opacity="${opacity}"><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(size * 1.6)}" ry="${f(size * 1.9)}" fill="${CANDLE}" fill-opacity="0.35" filter="url(#blur-4)"/>
    <path d="${smooth(flame)}" fill="${HIGHLIGHT}"/></g>`;
}

export interface ReliefOptions {
  /** Частота шума фактуры: камень ~0.05, кирпич ~0.09, металл ~0.015; можно «x y» для волокон. */
  frequency: number | string;
  octaves?: number;
  /** Вклад фактуры в высоту (0 — гладкая форма). */
  roughness: number;
  /** Скругление формы к краям (радиус размытия силуэта). */
  dome: number;
  /** Высота рельефа для освещения. */
  depth: number;
  /** Блеск: 0 — матовый камень, 1.5 — полированный металл. */
  gloss?: number;
  /** Узость блика (экспонента): 8 — широкий, 40 — точечный. */
  sharpness?: number;
  /** Насколько сильно освещение меняет цвет (1 — полностью). */
  strength?: number;
  seed?: number;
}

/**
 * Рельефное освещение материала. Карта высот = купол (размытый силуэт — объём к краям)
 * + шум фактуры. Её освещает тёплая свеча сверху слева (feDiffuseLighting), блестящие
 * материалы получают блик (feSpecularLighting). Цвет рисунка умножается на свет, блик
 * добавляется сверху, результат обрезается по исходному силуэту.
 */
export function relief(id: string, options: ReliefOptions): string {
  const strength = options.strength ?? 1;
  const gloss = options.gloss ?? 0;
  // Плоская поверхность под таким светом даёт ≈0.64 — поднимаем, чтобы средний тон сохранялся
  const diffuse = 1.45;
  const specular = gloss > 0
    ? `<feSpecularLighting in="height" surfaceScale="${options.depth}" specularConstant="${gloss}" specularExponent="${options.sharpness ?? 18}" lighting-color="${HIGHLIGHT}" result="spec"><feDistantLight azimuth="225" elevation="42"/></feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feComposite in="lit" in2="specIn" operator="arithmetic" k2="1" k3="1" result="shine"/>`
    : `<feOffset in="lit" result="shine"/>`;
  return `<filter id="${id}" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${options.dome}" result="dome"/>
    <feTurbulence type="fractalNoise" baseFrequency="${options.frequency}" numOctaves="${options.octaves ?? 4}" seed="${options.seed ?? 7}" result="noise"/>
    <!-- Высота не должна упираться в 1, иначе фактура внутри силуэта срезается -->
    <feComposite in="dome" in2="noise" operator="arithmetic" k2="0.62" k3="${options.roughness * 0.38}" result="heightRaw"/>
    <!-- Карта высот 8-битная: на гладких формах ступени дают кольца. Мелкое зерно их разбивает -->
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="${(options.seed ?? 7) + 1}" result="dither"/>
    <feComposite in="heightRaw" in2="dither" operator="arithmetic" k2="1" k3="0.012" k4="-0.006" result="heightDither"/>
    <feGaussianBlur in="heightDither" stdDeviation="1" result="height"/>
    <feDiffuseLighting in="height" surfaceScale="${options.depth}" diffuseConstant="${diffuse}" lighting-color="${CANDLE}" result="light"><feDistantLight azimuth="225" elevation="38"/></feDiffuseLighting>
    <feComponentTransfer in="light" result="lightMix"><feFuncR type="linear" slope="${strength}" intercept="${1 - strength}"/><feFuncG type="linear" slope="${strength}" intercept="${1 - strength}"/><feFuncB type="linear" slope="${strength}" intercept="${1 - strength}"/></feComponentTransfer>
    <feComposite in="SourceGraphic" in2="lightMix" operator="arithmetic" k1="1" result="lit"/>
    ${specular}
    <feComposite in="shine" in2="SourceAlpha" operator="in"/>
  </filter>`;
}

export interface EdgeOptions {
  /** Сдвиг силуэта: положительный (вниз вправо) оставляет полосу на освещённом краю сверху слева. */
  dx: number;
  dy: number;
  blur: number;
  color: string;
  opacity: number;
}

/**
 * Полоса света или тени вдоль края формы. Фигура с этим фильтром рисует только полосу:
 * силуэт минус сдвинутый силуэт, размытый и обрезанный по форме. Тёплый контровой свет
 * свечи — сдвиг вниз вправо, холодная собственная тень — вверх влево.
 */
export function edge(id: string, options: EdgeOptions): string {
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feOffset in="SourceAlpha" dx="${options.dx}" dy="${options.dy}" result="shifted"/>
    <feComposite in="SourceAlpha" in2="shifted" operator="out" result="band"/>
    <feGaussianBlur in="band" stdDeviation="${options.blur}" result="soft"/>
    <feComposite in="soft" in2="SourceAlpha" operator="in" result="inside"/>
    <feFlood flood-color="${options.color}" flood-opacity="${options.opacity}"/>
    <feComposite in2="inside" operator="in"/>
  </filter>`;
}

/**
 * Затемнение по всему краю формы (эффект Френеля у стекла и воды, затенение у пушистого):
 * силуэт минус размытый силуэт.
 */
export function rimDark(id: string, width: number, color: string, opacity: number): string {
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="${width}" result="blur"/>
    <feComposite in="SourceAlpha" in2="blur" operator="arithmetic" k2="1.6" k3="-1.6" result="band"/>
    <feFlood flood-color="${color}" flood-opacity="${opacity}"/>
    <feComposite in2="band" operator="in"/>
  </filter>`;
}

/**
 * Тень предмета на поверхности стола: широкая холодная полутень и плотная тень касания.
 * Свет сверху слева, поэтому тень уходит вправо.
 */
export function groundShadow(cx: number, cy: number, rx: number, ry: number, opacity = 1): string {
  return `<g opacity="${opacity}">
    <ellipse cx="${f(cx + rx * 0.16)}" cy="${f(cy + ry * 0.15)}" rx="${f(rx * 1.12)}" ry="${f(ry * 1.25)}" fill="${COLD}" fill-opacity="0.4" filter="url(#blur-8)"/>
    <ellipse cx="${f(cx + rx * 0.05)}" cy="${f(cy)}" rx="${f(rx * 0.82)}" ry="${f(ry * 0.6)}" fill="#0d0a08" fill-opacity="0.55" filter="url(#blur-4)"/>
  </g>`;
}

/** Искры, пылинки, капельки: мягкий ореол и яркое ядро. */
export function speck(x: number, y: number, r: number, color: string, core = HIGHLIGHT, halo = 0.5): string {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.4)}" fill="${color}" fill-opacity="${halo}" filter="url(#blur-2)"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${core}"/>`;
}

export interface ElementArt {
  id: string;
  render(): string;
}
