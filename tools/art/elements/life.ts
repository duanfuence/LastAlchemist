import { HIGHLIGHT, INK, defs, ellipse, groundShadow, ink, inkPath, radial, rng, smooth, svg, type ElementArt, type Pt } from '../lib';

/**
 * Жизнь: яйцо в гнезде из соломы, внутри которого уже теплится жизнь.
 * Скорлупа просвечивает тёплым светом изнутри (сильнее у трещины), в трещине — живой
 * золотистый свет. Гнездо — переплетённая сухая трава, перья пуха.
 * Свечение мягкое и тёплое, без ореола на всю страницу.
 */

const EGG: Pt[] = ellipse([128, 146], 46, 60, 28).map(([x, y]) => [x, y < 146 ? 146 - (146 - y) * 1.04 : y] as Pt);

function render(): string {
  const d = smooth(EGG);
  const extra = [
    radial('shell', [118, 128], 70, [
      [0, '#fbf2e0'],
      [0.5, '#e8d4b0'],
      [1, '#a8885e'],
    ], [108, 112]),
    radial('inner-light', [140, 150], 40, [
      [0, '#ffd27a', 0.8],
      [0.5, '#ffb04a', 0.35],
      [1, '#ffb04a', 0],
    ]),
    `<clipPath id="egg-clip"><path d="${d}"/></clipPath>`,
  ].join('');
  const crack: Pt[] = [[152, 112], [146, 124], [154, 132], [144, 146], [152, 156], [146, 166]];
  // Гнездо: множество изогнутых соломинок вокруг основания
  const random = rng(7);
  const straws = (front: boolean): string =>
    Array.from({ length: front ? 34 : 26 }, (_, i) => {
      const a = (front ? 0.1 : Math.PI + 0.1) + random() * (Math.PI - 0.2);
      const r = 58 + random() * 16;
      const cx = 128 + Math.cos(a) * r;
      const cy = 200 + Math.sin(a) * r * 0.32;
      const len = 26 + random() * 22;
      const tilt = a + Math.PI / 2 + (random() - 0.5) * 0.8;
      const pts: Pt[] = [[cx - Math.cos(tilt) * len * 0.5, cy - Math.sin(tilt) * len * 0.2], [cx, cy + (random() - 0.5) * 6], [cx + Math.cos(tilt) * len * 0.5, cy + Math.sin(tilt) * len * 0.2]];
      const color = random() > 0.5 ? '#c4a062' : random() > 0.5 ? '#9a7a44' : '#6e5430';
      return inkPath(ink(pts, { width: 2 + random() * 1.4, taper: [0.2, 0.3], shade: 0.4, seed: 100 + i + (front ? 50 : 0) }), color) +
        inkPath(ink(pts, { width: 0.5, taper: [0.2, 0.3], shade: 0, seed: 200 + i + (front ? 50 : 0) }), INK, 0.4);
    }).join('');
  return svg(`${defs(extra)}
  ${groundShadow(130, 222, 84, 8)}
  <ellipse cx="128" cy="204" rx="74" ry="22" fill="#3a2a18"/>
  ${straws(false)}
  <ellipse cx="128" cy="200" rx="56" ry="14" fill="#1e140c" fill-opacity="0.7" filter="url(#blur-2)"/>
  <!-- Яйцо: скорлупа светится изнутри -->
  <path d="${d}" fill="url(#shell)"/>
  <g clip-path="url(#egg-clip)">
    <ellipse cx="146" cy="146" rx="40" ry="46" fill="url(#inner-light)" style="mix-blend-mode:screen"/>
    <path d="${d}" fill="#000" filter="url(#core-cold)"/>
    <path d="${d}" fill="#000" filter="url(#rim-warm)"/>
    <!-- Крапинки на скорлупе -->
    ${Array.from({ length: 16 }, () => `<circle cx="${(96 + random() * 64).toFixed(1)}" cy="${(100 + random() * 90).toFixed(1)}" r="${(0.6 + random() * 1.2).toFixed(1)}" fill="#8a6a44" fill-opacity="0.4"/>`).join('')}
  </g>
  <path d="${smooth([[104, 108], [116, 96], [126, 94], [112, 106], [106, 120]])}" fill="${HIGHLIGHT}" fill-opacity="0.6"/>
  <!-- Трещина: изнутри пробивается свет -->
  <path d="${ink(crack, { width: 4, taper: [0.2, 0.3], shade: 0, seed: 3, raw: true })}" fill="#ffb84a" filter="url(#blur-2)"/>
  <path d="${ink(crack, { width: 1.6, taper: [0.2, 0.3], shade: 0, seed: 4, raw: true })}" fill="#fff2c0"/>
  ${inkPath(ink(crack.map(([x, y]) => [x + 1.2, y + 0.6] as Pt), { width: 0.8, taper: [0.2, 0.3], shade: 0, seed: 5, raw: true }), INK, 0.7)}
  ${inkPath(ink(EGG, { width: 1.8, closed: true, shade: 1.2, seed: 6 }), INK, 0.85)}
  ${straws(true)}
  <!-- Пёрышко пуха на краю гнезда -->
  <path d="${smooth([[184, 196], [198, 186], [206, 190], [194, 200]])}" fill="#efe6d6" fill-opacity="0.9"/>
  `);
}

export const life: ElementArt = { id: 'life', render };
