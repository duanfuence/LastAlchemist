import { CANDLE, defs, svg, type ElementArt } from '../lib';
import { CLOUD_SOFT, cloud as drawCloud, cloudDefs } from '../kit';

/**
 * Облако: высокое кучевое облако в тёплом свете свечи.
 * Мягкая материя без контура: вершины клубов светятся тёплым, брюхо ровное и холодное,
 * снизу отрываются тонкие пряди. Далеко внизу на странице — едва заметная тень.
 */

const PUFFS: readonly (readonly [number, number, number])[] = [
  [84, 138, 30],
  [176, 134, 32],
  [116, 112, 38],
  [152, 100, 36],
  [126, 82, 30],
  [62, 156, 22],
  [202, 156, 22],
  [100, 150, 30],
  [148, 146, 34],
  [180, 160, 22],
];

function render(): string {
  const extra = [
    CLOUD_SOFT,
    cloudDefs('c', { light: '#fff6e2', body: '#d8cfbf', dark: '#6c7378' }),
  ].join('');
  const wisps = [
    [70, 176, 44, 3.5],
    [150, 182, 52, 3],
    [112, 190, 34, 2.4],
  ]
    .map(([x, y, w, h]) => `<ellipse cx="${x! + w! / 2}" cy="${y}" rx="${w! / 2}" ry="${h}" fill="#a7a9a4" fill-opacity="0.45" filter="url(#blur-2)"/>`)
    .join('');
  return svg(`${defs(extra)}
  <ellipse cx="140" cy="226" rx="70" ry="7" fill="#1d3634" fill-opacity="0.18" filter="url(#blur-8)"/>
  ${wisps}
  ${drawCloud('c', PUFFS, 176)}
  <!-- Самая высокая вершина ловит свет свечи -->
  <ellipse cx="116" cy="64" rx="24" ry="12" fill="${CANDLE}" fill-opacity="0.3" filter="url(#blur-8)"/>
  `);
}

export const cloud: ElementArt = { id: 'cloud', render };
