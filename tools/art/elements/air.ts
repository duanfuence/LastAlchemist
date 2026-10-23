import { HIGHLIGHT, INK, defs, ink, inkPath, linear, rng, smooth, spline, svg, type ElementArt, type Pt } from '../lib';

/**
 * Воздух: лёгкое перо, подхваченное бледными потоками воздуха.
 * Сам воздух невидим — его показывают завитки течений (светлая лента с холодной тенью)
 * и перо, которое они несут. Перо подробное: стержень, бородки, расщеп опахала.
 * Ни свечения, ни тени на столе: предмет парит.
 */

const RACHIS: Pt[] = [[70, 224], [92, 182], [118, 136], [148, 92], [184, 44]];

/**
 * Маховое перо: голый очин внизу, широкое опахало с одной стороны и узкое с другой,
 * поперечные тёмные полосы, рваный край с расщепами.
 */
function feather(): string {
  const axis = spline(RACHIS, false, 12);
  const n = axis.length;
  const random = rng(3);
  const start = Math.floor(n * 0.18);
  const left: Pt[] = [];
  const right: Pt[] = [];
  const barbs: string[] = [];
  const bands: string[] = [];
  for (let i = start; i < n; i += 1) {
    const t = (i - start) / (n - 1 - start);
    const p = axis[i]!;
    const q = axis[Math.min(n - 1, i + 1)]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const u: Pt = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    const nrm: Pt = [-u[1], u[0]];
    const shape = Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (t > 0.85 ? (1 - t) / 0.15 : 1);
    // Расщепы: в двух местах бородки расходятся
    const split = Math.abs(t - 0.42) < 0.025 || Math.abs(t - 0.7) < 0.02 ? 0.6 : 1;
    const wl = (30 * shape + 2) * split;
    const wr = 14 * shape + 1.5;
    const sweep = 12 + t * 4;
    const l: Pt = [p[0] + nrm[0] * wl - u[0] * sweep, p[1] + nrm[1] * wl - u[1] * sweep];
    const r: Pt = [p[0] - nrm[0] * wr - u[0] * sweep * 0.6, p[1] - nrm[1] * wr - u[1] * sweep * 0.6];
    left.push(l);
    right.push(r);
    barbs.push(ink([p, [l[0] + (random() - 0.5) * 1.5, l[1] + (random() - 0.5) * 1.5]], { width: 0.45, taper: [0.1, 0.8], shade: 0, seed: 10 + i }));
    if (i % 2 === 0) barbs.push(ink([p, r], { width: 0.45, taper: [0.1, 0.8], shade: 0, seed: 60 + i }));
    // Поперечные полосы рисунка пера
    if (Math.floor(t * 9) % 2 === 1 && i % 1 === 0) bands.push(ink([p, l], { width: 2.4, taper: [0.2, 0.4], shade: 0, seed: 120 + i }));
  }
  const vane = smooth([axis[start]!, ...left, axis[n - 1]!, ...right.reverse()]);
  return `<clipPath id="vane-clip"><path d="${vane}"/></clipPath>
    <path d="${vane}" fill="url(#vane)"/>
    <g clip-path="url(#vane-clip)"><path d="${bands.join('')}" fill="#5a4636" fill-opacity="0.45"/></g>
    <path d="${vane}" fill="#000" filter="url(#core-cold)"/>
    <path d="${vane}" fill="#000" filter="url(#rim-warm-thin)"/>
    <path d="${barbs.join('')}" fill="#3e3226" fill-opacity="0.45"/>
    ${inkPath(ink(RACHIS, { width: 3, taper: [0.02, 0.92], shade: 0.4, seed: 2 }), '#f0e6d0')}
    ${inkPath(ink(RACHIS, { width: 0.9, taper: [0.02, 0.92], shade: 0, seed: 4 }), INK, 0.55)}
    ${inkPath(ink([...left], { width: 0.9, taper: [0.2, 0.3], shade: 0, seed: 5 }), INK, 0.45)}`;
}

/** Поток воздуха: светлая лента, на конце завиток. */
function current(points: Pt[], width: number, seed: number, opacity: number): string {
  const d = ink(points, { width, taper: [0.5, 0.5], shade: 0, pressure: 0.25, seed });
  return `<path d="${d}" fill="#7f9298" fill-opacity="${(opacity * 0.5).toFixed(2)}" transform="translate(1.5 2.5)"/>
    <path d="${d}" fill="#f1f3ee" fill-opacity="${opacity}"/>
    <path d="${ink(points, { width: width * 0.3, taper: [0.5, 0.5], shade: 0, seed: seed + 1 })}" fill="${HIGHLIGHT}" fill-opacity="${opacity}" transform="translate(-0.8 -0.8)"/>`;
}

function render(): string {
  const extra = linear('vane', [90, 60], [190, 200], [
    [0, '#d8ccb4'],
    [0.5, '#a89880'],
    [1, '#6a5c4c'],
  ]);
  return svg(`${defs(extra)}
  ${current([[20, 150], [70, 132], [120, 140], [160, 160], [186, 152], [190, 136], [176, 132], [172, 142]], 5, 21, 0.75)}
  ${current([[40, 92], [96, 78], [150, 84], [206, 70], [228, 78], [226, 92], [214, 92]], 4, 31, 0.6)}
  ${feather()}
  ${current([[60, 214], [112, 196], [168, 204], [214, 186], [236, 168], [228, 156], [218, 162]], 5.5, 41, 0.8)}
  `);
}

export const air: ElementArt = { id: 'air', render };
