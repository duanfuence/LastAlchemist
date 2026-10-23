import { HIGHLIGHT, INK, defs, ellipse, ink, inkPath, linear, radial, rng, smooth, svg, type ElementArt, type Pt } from '../lib';
import { drawLeaf } from '../kit';

/**
 * Болото: стоячая мутная вода, рогоз и тростник, лист кувшинки, поднимаются пузыри газа,
 * над водой стелется туман. Вода не прозрачная, как в капле, а бурая и маслянистая:
 * в ней отражаются стебли, по поверхности — ряска.
 */

function cattail(x: number, base: number, h: number, lean: number, seed: number): string {
  const stem: Pt[] = [[x, base], [x + lean * 0.4, base - h * 0.5], [x + lean, base - h]];
  const top = stem[2]!;
  const head = ellipse([top[0] - lean * 0.12, top[1] + 18], 6.4, 17, 16);
  return inkPath(ink(stem, { width: 3, taper: [0, 0.3], shade: 0.5, seed }), '#6a7438') +
    `<path d="${smooth(head)}" fill="url(#cattail)"/>` +
    inkPath(ink(head, { width: 1, closed: true, shade: 1, seed: seed + 1 }), INK, 0.8) +
    inkPath(ink([[top[0], top[1] + 2], [top[0] + lean * 0.1, top[1] - 10]], { width: 1, taper: [0, 0.9], shade: 0, seed: seed + 2 }), '#6a7438');
}

function reed(x: number, base: number, h: number, lean: number, seed: number): string {
  return inkPath(ink([[x, base], [x + lean * 0.3, base - h * 0.6], [x + lean, base - h]], { width: 5, taper: [0, 0.95], shade: 0.5, seed }), '#56662e') +
    inkPath(ink([[x, base], [x + lean * 0.3, base - h * 0.6], [x + lean, base - h]], { width: 0.6, taper: [0, 0.95], shade: 0, seed: seed + 1 }), INK, 0.4);
}

function render(): string {
  const pool = ellipse([128, 208], 104, 22, 28);
  const extra = [
    radial('bog', [120, 204], 104, [
      [0, '#55583a'],
      [0.6, '#3a3c26'],
      [1, '#1e2014'],
    ]),
    linear('cattail', [0, 0], [10, 0], [
      [0, '#7a4a28'],
      [1, '#3e2210'],
    ]),
    linear('mist', [0, 150], [0, 200], [
      [0, '#e8e4d4', 0],
      [0.6, '#e8e4d4', 0.45],
      [1, '#e8e4d4', 0],
    ]),
    `<clipPath id="pool-clip"><path d="${smooth(pool)}"/></clipPath>`,
  ].join('');
  const random = rng(5);
  const duckweed = Array.from({ length: 40 }, () => {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random());
    const x = 128 + Math.cos(a) * r * 96;
    const y = 208 + Math.sin(a) * r * 18;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(1 + random() * 1.4).toFixed(1)}" ry="0.8" fill="${random() > 0.5 ? '#7c8a3a' : '#9aa448'}"/>`;
  }).join('');
  // Тростник отражается в воде: перевёрнутые бледные стебли
  const plants = `${reed(56, 206, 110, -16, 21)}${reed(66, 208, 150, 4, 22)}${reed(80, 210, 96, -6, 25)}${cattail(74, 208, 140, -8, 31)}${cattail(94, 210, 116, 6, 33)}${reed(172, 208, 120, 10, 23)}${cattail(186, 206, 150, 6, 32)}${reed(198, 208, 100, 20, 24)}`;
  return svg(`${defs(extra)}
  <ellipse cx="132" cy="222" rx="104" ry="12" fill="#0e0c08" fill-opacity="0.4" filter="url(#blur-4)"/>
  <path d="${smooth(pool)}" fill="url(#bog)" filter="url(#wash)"/>
  <g clip-path="url(#pool-clip)">
    <g transform="translate(0 412) scale(1 -1)" opacity="0.3">${plants}</g>
    ${duckweed}
    <path d="${smooth(pool)}" fill="#000" filter="url(#core-cold)"/>
  </g>
  ${inkPath(ink(pool, { width: 1.6, closed: true, shade: 0.8, seed: 3 }), INK, 0.75)}
  ${plants}
  <!-- Кувшинка -->
  <path d="${smooth([[120, 212], [132, 202], [152, 204], [158, 212], [146, 220], [128, 220]])}" fill="#4e6a2e"/>
  ${inkPath(ink([[120, 212], [132, 202], [152, 204], [158, 212], [146, 220], [128, 220], [120, 212]], { width: 1, shade: 1, seed: 40 }), INK, 0.7)}
  ${inkPath(ink([[139, 211], [124, 212]], { width: 1, taper: [0, 0], shade: 0, seed: 41 }), '#2a3a18')}
  ${drawLeaf([150, 214], [168, 188], 10, 2, '#5d7a34', 42)}
  <!-- Пузыри болотного газа -->
  ${[[108, 200, 2.6], [112, 192, 1.8], [168, 210, 2.2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#8a8a62" fill-opacity="0.35" stroke="#d6d4b8" stroke-opacity="0.6" stroke-width="0.6"/><circle cx="${x! - r! * 0.35}" cy="${y! - r! * 0.35}" r="${r! * 0.3}" fill="${HIGHLIGHT}"/>`).join('')}
  <!-- Туман над водой -->
  <ellipse cx="128" cy="186" rx="112" ry="16" fill="#ebe6d6" fill-opacity="0.4" filter="url(#blur-8)"/>
  `);
}

export const swamp: ElementArt = { id: 'swamp', render };
