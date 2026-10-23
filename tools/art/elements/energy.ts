import { HIGHLIGHT, defs, ink, inkPath, radial, rng, svg, type ElementArt, type Pt } from '../lib';

/**
 * Энергия: сгусток холодного света, висящий в воздухе, вокруг него трещат разряды.
 * Это единственный холодный источник света в серии: бело-голубое ядро, фиолетовый ореол,
 * ветвистые дуги срываются с поверхности. Под сгустком на странице — голубой отсвет.
 */

function arc(from: Pt, to: Pt, seed: number, width: number): Pt[] {
  const random = rng(seed);
  const pts: Pt[] = [from];
  const n = 7;
  for (let i = 1; i < n; i += 1) {
    const t = i / n;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const dx = -(to[1] - from[1]);
    const dy = to[0] - from[0];
    const len = Math.hypot(dx, dy) || 1;
    const off = (random() - 0.5) * width;
    pts.push([x + (dx / len) * off, y + (dy / len) * off]);
  }
  pts.push(to);
  return pts;
}

function render(): string {
  const extra = [
    radial('core', [124, 118], 58, [
      [0, '#ffffff'],
      [0.25, '#e6f0ff'],
      [0.55, '#8fb0ff'],
      [0.85, '#5a4ad0', 0.8],
      [1, '#3a2a9a', 0],
    ]),
    radial('halo', [128, 122], 110, [
      [0, '#9ab4ff', 0.5],
      [0.4, '#7a6ae0', 0.18],
      [1, '#7a6ae0', 0],
    ]),
    `<filter id="arc-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>`,
    `<filter id="plasma" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="21" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`,
  ].join('');
  const c: Pt = [128, 122];
  const arcs = [
    [[c[0] + 30, c[1] - 20], [216, 64]],
    [[c[0] - 32, c[1] + 10], [34, 150]],
    [[c[0] + 20, c[1] + 32], [190, 214]],
    [[c[0] - 18, c[1] - 34], [78, 36]],
    [[c[0] - 10, c[1] + 40], [96, 222]],
  ] as [Pt, Pt][];
  const arcPaths = arcs
    .map(([from, to], i) => {
      const pts = arc(from, to, 30 + i, 30);
      const branchFrom = pts[3]!;
      const branch = arc(branchFrom, [branchFrom[0] + (to[0] - branchFrom[0]) * 0.4 + 18, branchFrom[1] + (to[1] - branchFrom[1]) * 0.4 - 12], 40 + i, 12);
      const main = ink(pts, { width: 4.2, taper: [0.1, 0.8], shade: 0, seed: 50 + i, raw: true });
      const side = ink(branch, { width: 2.2, taper: [0.1, 0.9], shade: 0, seed: 60 + i, raw: true });
      return `<path d="${main}${side}" fill="#4a3ac8" filter="url(#arc-glow)"/><path d="${main}${side}" fill="#7f8cff" filter="url(#blur-1)"/><path d="${ink(pts, { width: 1.4, taper: [0.1, 0.8], shade: 0, seed: 80 + i, raw: true })}" fill="#f4f6ff"/>`;
    })
    .join('');
  return svg(`${defs(extra)}
  <ellipse cx="128" cy="122" rx="120" ry="110" fill="url(#halo)"/>
  <ellipse cx="128" cy="226" rx="60" ry="7" fill="#8fa8ff" fill-opacity="0.35" filter="url(#blur-4)"/>
  ${arcPaths}
  <circle cx="128" cy="122" r="58" fill="url(#core)" filter="url(#plasma)"/>
  <!-- Внутренние вихри плазмы -->
  ${[0, 1, 2].map((i) => inkPath(ink([[104 + i * 6, 112 + i * 8], [124, 100 + i * 10], [148 - i * 4, 116 + i * 6]], { width: 1.6, taper: [0.4, 0.4], shade: 0, seed: 70 + i }), '#6a7ae8', 0.5)).join('')}
  <circle cx="122" cy="116" r="14" fill="${HIGHLIGHT}" filter="url(#blur-4)"/>
  `);
}

export const energy: ElementArt = { id: 'energy', render };
