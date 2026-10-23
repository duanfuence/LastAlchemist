import { INK, defs, groundShadow, ink, inkPath, linear, polyD, relief, rng, stipple, svg, type ElementArt, type Pt } from '../lib';

/**
 * Кирпич: два обожжённых кирпича — один лежит, второй прислонён к нему.
 * Материал — пористая обожжённая глина: крупное матовое зерно, отбитые углы,
 * остатки серого раствора, тёмные пятна пережога. Грани — верх светлее, торец в тени.
 */

interface Box {
  top: Pt[];
  front: Pt[];
  side: Pt[];
}

/** Кирпич: точка переднего нижнего левого угла, длина, глубина, высота, наклон. */
function box(x: number, y: number, l: number, dpt: number, h: number, chip: number, seed: number): Box {
  const random = rng(seed);
  const j = (): number => (random() - 0.5) * 2.4;
  const dx = dpt * 0.55;
  const dy = -dpt * 0.42;
  const p0: Pt = [x + j(), y + j()];
  const p1: Pt = [x + l + j(), y + j()];
  const p2: Pt = [x + l + j(), y - h + j()];
  const p3: Pt = [x + chip, y - h];
  const p3b: Pt = [x, y - h + chip];
  const p4: Pt = [x + dx + j(), y - h + dy + j()];
  const p5: Pt = [x + l + dx + j(), y - h + dy + j()];
  const p6: Pt = [x + l + dx + j(), y + dy + j()];
  return { front: [p0, p1, p2, p3, p3b], top: [p3, p2, p5, p4, [p4[0] - chip * 0.3, p4[1] + chip * 0.6]], side: [p1, p6, p5, p2] };
}

function draw(b: Box, seed: number): string {
  const all = [...b.front, ...b.top, ...b.side];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const mortar = stipple({
    count: 60,
    bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    density: (x, y) => (Math.sin(x * 0.08 + seed) + Math.cos(y * 0.11) > 1.1 ? 0.9 : 0),
    radius: (_x, _y, r) => 0.5 + r() * 1,
    color: (_x, _y, r) => (r() > 0.5 ? '#bdb5a6' : '#9a9286'),
    seed,
    opacity: 0.6,
  });
  const clip = `brick-${seed}`;
  return `<clipPath id="${clip}"><path d="${polyD(b.front)}${polyD(b.top)}${polyD(b.side)}"/></clipPath>
    <path d="${polyD(b.front)}" fill="url(#clay-front)" filter="url(#r-clay)"/>
    <path d="${polyD(b.top)}" fill="url(#clay-top)" filter="url(#r-clay)"/>
    <path d="${polyD(b.side)}" fill="url(#clay-side)" filter="url(#r-clay)"/>
    <g clip-path="url(#${clip})">${mortar}</g>
    <path d="M${b.top[0]![0]} ${b.top[0]![1]}L${b.top[1]![0]} ${b.top[1]![1]}" stroke="#f0c8a0" stroke-width="1" stroke-opacity="0.6"/>
    ${inkPath(ink([...b.front, b.front[0]!], { width: 1.5, shade: 1, seed, raw: true }), INK, 0.85)}
    ${inkPath(ink([b.front[3]!, b.top[4]!, b.top[3]!, b.top[2]!, b.side[1]!, b.side[0]!], { width: 1.5, shade: 1, seed: seed + 1, raw: true }), INK, 0.85)}`;
}

function render(): string {
  const extra = [
    linear('clay-front', [0, 150], [0, 220], [
      [0, '#b0603a'],
      [1, '#6a3018'],
    ]),
    linear('clay-top', [60, 120], [200, 170], [
      [0, '#d6895a'],
      [1, '#9a5030'],
    ]),
    linear('clay-side', [0, 140], [0, 220], [
      [0, '#743418'],
      [1, '#3a180a'],
    ]),
    relief('r-clay', { frequency: 0.16, octaves: 4, roughness: 0.9, dome: 1.5, depth: 7, gloss: 0.05, strength: 1, seed: 121 }),
  ].join('');
  const lying = box(40, 216, 128, 52, 34, 9, 3);
  const leaning = box(0, 0, 118, 48, 30, 7, 5);
  // Верхний кирпич лежит на нижнем, чуть повёрнут: рисуется после нижнего
  return svg(`${defs(extra)}
  ${groundShadow(128, 214, 88, 8)}
  ${draw(lying, 9)}
  <g transform="translate(62 178) rotate(-6)">${groundShadow(62, -4, 56, 5, 0.6)}${draw(leaning, 7)}</g>
  <!-- Осколок и крошка у подножия -->
  <path d="M206 222 L214 214 L222 220 L218 226 Z" fill="#8a4426"/>
  ${inkPath(ink([[206, 222], [214, 214], [222, 220], [218, 226], [206, 222]], { width: 0.9, shade: 1, seed: 11, raw: true }), INK, 0.8)}
  `);
}

export const brick: ElementArt = { id: 'brick', render };
