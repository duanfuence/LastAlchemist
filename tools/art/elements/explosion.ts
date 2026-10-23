import { HIGHLIGHT, INK, defs, ink, inkPath, polyD, radial, rng, smooth, svg, type ElementArt, type Pt } from '../lib';
import { CLOUD_SOFT, cloud, cloudDefs } from '../kit';

/**
 * Взрыв: миг разрыва. Ослепительное ядро, огненный шар с языками, по краю — тёмный
 * клубящийся дым, во все стороны летят раскалённые осколки и искры, по земле
 * бежит кольцо ударной волны с пылью. Самый яркий рисунок серии, но свет — от ядра.
 */

function render(): string {
  const extra = [
    CLOUD_SOFT,
    cloudDefs('smoke', { light: '#8a7466', body: '#463a34', dark: '#181210' }),
    radial('fireball', [128, 128], 62, [
      [0, '#ffffff'],
      [0.18, '#fff3c0'],
      [0.45, '#ffb43e'],
      [0.75, '#e8561a'],
      [1, '#a0260c', 0],
    ]),
    `<filter id="burst" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="31" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1"/>
    </filter>`,
    `<filter id="spark-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>`,
  ].join('');
  const random = rng(11);
  // Звезда огненных языков
  const star: Pt[] = [];
  for (let i = 0; i < 22; i += 1) {
    const a = (i / 22) * Math.PI * 2;
    const r = i % 2 === 0 ? 70 + random() * 26 : 40 + random() * 10;
    star.push([128 + Math.cos(a) * r, 124 + Math.sin(a) * r * 0.9]);
  }
  // Дым клубится сверху и по бокам, снизу его отбрасывает ударная волна
  const smoke: (readonly [number, number, number])[] = Array.from({ length: 13 }, (_, i) => {
    const a = Math.PI * (0.85 + (i / 12) * 1.3);
    const r = 66 + random() * 14;
    return [128 + Math.cos(a) * r, 120 + Math.sin(a) * r * 0.85, 22 + random() * 10] as const;
  });
  const shards = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + random() * 0.3;
    const r = 92 + random() * 22;
    const x = 128 + Math.cos(a) * r;
    const y = 124 + Math.sin(a) * r * 0.85;
    const s = 3 + random() * 4;
    const pts: Pt[] = [[x, y - s], [x + s * 0.8, y + s * 0.3], [x - s * 0.4, y + s * 0.8]];
    const trail = ink([[128 + Math.cos(a) * (r - 26), 124 + Math.sin(a) * (r - 26) * 0.85], [x, y]], { width: 1.6, taper: [0.9, 0.05], shade: 0, seed: 40 + i });
    return `<path d="${trail}" fill="#ffb24a" fill-opacity="0.7" filter="url(#spark-glow)"/><path d="${polyD(pts)}" fill="#2a1a10"/>${inkPath(ink([...pts, pts[0]!], { width: 0.6, shade: 0, seed: 60 + i, raw: true }), '#ff8a30', 0.8)}`;
  }).join('');
  const sparks = Array.from({ length: 16 }, (_, i) => {
    const a = random() * Math.PI * 2;
    const r = 60 + random() * 60;
    const x = 128 + Math.cos(a) * r;
    const y = 124 + Math.sin(a) * r * 0.85;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + random() * 1.2).toFixed(1)}" fill="#fff0c0"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#ffa040" fill-opacity="0.4" filter="url(#spark-glow)"/>${i % 4 === 0 ? '' : ''}`;
  }).join('');
  return svg(`${defs(extra)}
  <!-- Ударная волна по земле -->
  <ellipse cx="128" cy="224" rx="104" ry="12" fill="#6a5a48" fill-opacity="0.45" filter="url(#blur-4)"/>
  ${inkPath(ink([[30, 224], [70, 230], [128, 232], [186, 230], [226, 224]], { width: 1.6, taper: [0.3, 0.3], shade: 0, seed: 5 }), INK, 0.4)}
  ${cloud('smoke', smoke, 256)}
  <path d="${smooth(star)}" fill="url(#fireball)" filter="url(#burst)"/>
  <circle cx="128" cy="124" r="34" fill="#fff6d8" filter="url(#blur-8)"/>
  <circle cx="128" cy="124" r="16" fill="${HIGHLIGHT}"/>
  ${shards}
  ${sparks}
  `);
}

export const explosion: ElementArt = { id: 'explosion', render };
