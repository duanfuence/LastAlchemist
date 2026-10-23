import { HIGHLIGHT, INK, candleReflection, defs, groundShadow, ink, inkPath, linear, polyD, relief, svg, type ElementArt, type Pt } from '../lib';

/**
 * Металл: два кованых слитка — один лежит, второй прислонён сзади.
 * Материал — тусклое железо со следами шлифовки: продольные волокна в рельефе,
 * резкие светлые рёбра, на верхней грани отражается пламя свечи, клеймо — знак Марса (железа).
 * Холодный сине-серый тон, никакого золота.
 */

interface Ingot {
  top: Pt[];
  front: Pt[];
  side: Pt[];
}

/** Слиток-трапеция: длина, ширина, высота, угол наклона верхней грани. */
function ingot(x: number, y: number, length: number, depth: number, height: number): Ingot {
  const bevel = height * 0.55;
  const a: Pt = [x + bevel, y];
  const b: Pt = [x + length - bevel * 0.4, y];
  const c: Pt = [x + length + depth * 0.5 - bevel * 0.4, y - depth * 0.45];
  const dd: Pt = [x + bevel + depth * 0.5, y - depth * 0.45];
  const e: Pt = [x, y + height];
  const g: Pt = [x + length, y + height];
  const h: Pt = [x + length + depth * 0.5, y + height - depth * 0.45];
  return { top: [a, b, c, dd], front: [a, b, g, e], side: [b, c, h, g] };
}

function draw(bar: Ingot, seed: number, mark: boolean): string {
  const faces = `<path d="${polyD(bar.front)}" fill="url(#iron-front)" filter="url(#r-iron)"/>
    <path d="${polyD(bar.side)}" fill="url(#iron-side)" filter="url(#r-iron)"/>
    <path d="${polyD(bar.top)}" fill="url(#iron-top)" filter="url(#r-iron-top)"/>`;
  const [a, b, c, dd] = bar.top;
  const [, , g, e] = bar.front;
  const edges = `<path d="M${a![0]} ${a![1]}L${b![0]} ${b![1]}" stroke="${HIGHLIGHT}" stroke-width="1.2" stroke-opacity="0.85"/>
    <path d="M${a![0]} ${a![1]}L${dd![0]} ${dd![1]}" stroke="${HIGHLIGHT}" stroke-width="0.9" stroke-opacity="0.6"/>
    <path d="M${b![0]} ${b![1]}L${c![0]} ${c![1]}" stroke="#c9d2d6" stroke-width="0.8" stroke-opacity="0.5"/>`;
  const outline = inkPath(ink([e!, a!, dd!, c!, bar.side[2]!, g!, e!], { width: 1.6, shade: 1, seed, raw: true }), INK, 0.9);
  const cx = (a![0] + b![0] + c![0] + dd![0]) / 4;
  const cy = (a![1] + b![1] + c![1] + dd![1]) / 4;
  const stamp = mark
    ? `<g transform="translate(${cx} ${cy}) scale(1 0.5) rotate(-8)" fill="none" stroke-linecap="round">
        <g stroke="${HIGHLIGHT}" stroke-opacity="0.5" stroke-width="1.6" transform="translate(-0.8 -0.8)"><circle cx="-2" cy="2" r="6"/><path d="M2.5 -2.5 L9 -9 M3.5 -9 H9 V-3.5"/></g>
        <g stroke="#1a2024" stroke-opacity="0.85" stroke-width="1.6"><circle cx="-2" cy="2" r="6"/><path d="M2.5 -2.5 L9 -9 M3.5 -9 H9 V-3.5"/></g>
      </g>`
    : '';
  return `${faces}${stamp}${edges}${outline}`;
}

function render(): string {
  const extra = [
    linear('iron-top', [60, 130], [200, 170], [
      [0, '#c4c8c6'],
      [0.5, '#8c9294'],
      [1, '#5a6064'],
    ]),
    linear('iron-front', [0, 150], [0, 200], [
      [0, '#6f767a'],
      [1, '#2c3134'],
    ]),
    linear('iron-side', [0, 130], [0, 200], [
      [0, '#4a5054'],
      [1, '#1a1e20'],
    ]),
    relief('r-iron', { frequency: '0.012 0.35', octaves: 3, roughness: 0.4, dome: 1.5, depth: 6, gloss: 1.1, sharpness: 22, strength: 0.7, seed: 111 }),
    relief('r-iron-top', { frequency: '0.012 0.35', octaves: 3, roughness: 0.3, dome: 2, depth: 5, gloss: 1.4, sharpness: 26, strength: 0.6, seed: 112 }),
  ].join('');
  const back = ingot(70, 128, 120, 44, 26);
  const front = ingot(44, 170, 136, 48, 30);
  return svg(`${defs(extra)}
  ${groundShadow(132, 214, 90, 8)}
  <g transform="rotate(-8 130 150)">${draw(back, 3, false)}</g>
  ${groundShadow(130, 200, 60, 4, 0.6)}
  ${draw(front, 4, true)}
  ${candleReflection(88, 160, 4.5, 0.9)}
  `);
}

export const metal: ElementArt = { id: 'metal', render };
