/**
 * Процедурные фактуры книги: пергамент страниц, кожа переплёта, дерево стола.
 *
 *   npm run art:textures
 *
 * Все фактуры бесшовные: шум периодический, волокна и пятна дорисовываются через край.
 * Контраст пергамента намеренно низкий — текст на странице должен читаться без усилий.
 * Генерация идёт в Chromium (canvas), результат — WebP в assets/textures.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets/textures');

interface TextureJob {
  name: string;
  size: number;
  quality: number;
  kind: 'parchment' | 'leather' | 'wood';
  seed: number;
}

const JOBS: TextureJob[] = [
  { name: 'parchment', size: 1024, quality: 0.82, kind: 'parchment', seed: 7 },
  { name: 'leather', size: 512, quality: 0.8, kind: 'leather', seed: 3 },
  { name: 'wood', size: 1024, quality: 0.78, kind: 'wood', seed: 11 },
];

/** Генератор, выполняемый в браузере. Самодостаточен: передаётся в page.evaluate как функция. */
function generate(job: TextureJob): string {
  const { size, seed, kind } = job;
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** Периодический шум значений: period клеток на сторону. */
  const makeNoise = (period: number): ((x: number, y: number) => number) => {
    const grid = new Float32Array(period * period).map(() => random());
    const smooth = (t: number): number => t * t * (3 - 2 * t);
    return (x: number, y: number) => {
      const gx = (x / size) * period;
      const gy = (y / size) * period;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const tx = smooth(gx - x0);
      const ty = smooth(gy - y0);
      const at = (i: number, j: number): number => grid[(((j % period) + period) % period) * period + (((i % period) + period) % period)]!;
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return a + (b - a) * ty;
    };
  };
  const fbm = (periods: number[], weights: number[]): ((x: number, y: number) => number) => {
    const layers = periods.map(makeNoise);
    const total = weights.reduce((sum, w) => sum + w, 0);
    return (x, y) => layers.reduce((sum, layer, i) => sum + layer(x, y) * weights[i]!, 0) / total;
  };

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const data = image.data;

  if (kind === 'parchment') {
    const broad = fbm([3, 6, 12], [1, 0.6, 0.35]);
    const mid = fbm([24, 48], [1, 0.5]);
    const edge = fbm([16, 32], [1, 0.5]);
    // Пятна старины: неправильной формы, с более тёмной «линией прилива» по краю
    const stains = Array.from({ length: 7 }, () => ({
      x: random() * size,
      y: random() * size,
      r: 50 + random() * 140,
      strength: 0.014 + random() * 0.02,
    }));
    const wrapped = (d: number): number => {
      const a = Math.abs(d) % size;
      return Math.min(a, size - a);
    };
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const b = broad(x, y) - 0.5;
        const m = mid(x, y) - 0.5;
        const grain = (random() - 0.5) * 0.035;
        let stain = 0;
        for (const st of stains) {
          const d = Math.hypot(wrapped(x - st.x), wrapped(y - st.y)) / st.r;
          if (d > 1.5) continue;
          const shaped = d + (edge(x, y) - 0.5) * 0.9;
          // Внутри пятно слабое, к краю краска собирается в более тёмную линию
          if (shaped < 0.92) stain += st.strength * (0.3 + 0.9 * Math.pow(Math.max(0, shaped), 6));
          else if (shaped < 1.2) stain += st.strength * 0.95 * (1 - (shaped - 0.92) / 0.28) ** 2;
        }
        const light = 1 + b * 0.17 + m * 0.05 + grain;
        // Тёплый тон: тёмные места уходят в охру, светлые — в сливочный
        const warm = b * 0.06;
        const i = (y * size + x) * 4;
        // Пятно желтит бумагу: синий уходит сильнее красного
        // Старая бумага подземной библиотеки: темнее и желтее, чем свежий пергамент
        data[i] = 214 * light + warm * 30 - stain * 260;
        data[i + 1] = 195 * light + warm * 10 - stain * 420;
        data[i + 2] = 156 * light - warm * 20 - stain * 700;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const wrap = (draw: (dx: number, dy: number) => void): void => {
      for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy);
    };
    // Следы сырости: редкие холодные серо-зелёные скопления точек
    for (let k = 0; k < 14; k += 1) {
      const cx = random() * size;
      const cy = random() * size;
      const spread = 6 + random() * 18;
      for (let j = 0; j < 26; j += 1) {
        const px = cx + (random() - 0.5) * spread * 2;
        const py = cy + (random() - 0.5) * spread * 2;
        const r = 0.5 + random() * 1.4;
        ctx.fillStyle = `rgba(60, 74, 58, ${0.05 + random() * 0.09})`;
        wrap((dx, dy) => {
          ctx.beginPath();
          ctx.arc(px + dx, py + dy, r, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    // Мелкие крапинки (фоксинг)
    for (let k = 0; k < 320; k += 1) {
      const cx = random() * size;
      const cy = random() * size;
      const r = 0.6 + random() * 1.8;
      ctx.fillStyle = `rgba(110, 66, 32, ${0.08 + random() * 0.16})`;
      wrap((dx, dy) => {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // Волокна бумаги: короткие изогнутые нити, светлые и тёмные
    ctx.lineCap = 'round';
    for (let k = 0; k < 2600; k += 1) {
      const x = random() * size;
      const y = random() * size;
      const length = 5 + random() * random() * 34;
      const angle = random() * Math.PI * 2;
      const bend = (random() - 0.5) * 0.8;
      const dark = random() < 0.45;
      ctx.strokeStyle = dark ? `rgba(110, 80, 45, ${0.08 + random() * 0.12})` : `rgba(245, 232, 200, ${0.1 + random() * 0.16})`;
      ctx.lineWidth = 0.5 + random() * 0.7;
      wrap((dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.quadraticCurveTo(
          x + dx + Math.cos(angle + bend) * length * 0.5,
          y + dy + Math.sin(angle + bend) * length * 0.5,
          x + dx + Math.cos(angle) * length,
          y + dy + Math.sin(angle) * length,
        );
        ctx.stroke();
      });
    }
  } else if (kind === 'leather') {
    const broad = fbm([4, 8], [1, 0.5]);
    const pebble = fbm([128, 256], [1, 0.6]);
    const wear = fbm([4, 8], [1, 0.4]);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const b = broad(x, y) - 0.5;
        // Зерно кожи: светлые бугорки, тёмные впадины между ними
        const bump = Math.pow(pebble(x, y), 1.5) - 0.32;
        // Потёртости: светлее и глаже там, где кожу касались руки
        const rub = Math.max(0, wear(x, y) - 0.58) * 0.5;
        const light = 1 + b * 0.24 + bump * 0.34 * (1 - rub * 2) + rub + (random() - 0.5) * 0.06;
        const i = (y * size + x) * 4;
        // Почти чёрная кожа цвета запёкшейся крови; потёртости светлеют в коричневый
        data[i] = 54 * light + rub * 40;
        data[i + 1] = 25 * light + rub * 22;
        data[i + 2] = 20 * light + rub * 12;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  } else {
    const warp = fbm([4, 8], [1, 0.5]);
    const streak = fbm([128, 256], [1, 0.5]);
    const knots = fbm([6], [1]);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        // Волокна дерева идут вдоль x: годичные слои слегка изгибаются шумом
        const w = warp(x, y);
        const rings = Math.sin(((y / size) * 48 + w * 3 + knots(x, y) * 2) * Math.PI * 2) * 0.5 + 0.5;
        // Тонкие продольные прожилки: шум, растянутый вдоль доски
        const fine = streak((x * 0.04) % size, y);
        const light = 0.7 + rings * 0.12 + (fine - 0.5) * 0.4 + (random() - 0.5) * 0.04;
        const i = (y * size + x) * 4;
        // Тёмный морёный дуб
        data[i] = 34 * light;
        data[i + 1] = 25 * light;
        data[i + 2] = 19 * light;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  return canvas.toDataURL('image/webp', job.quality);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env['PW_CHROMIUM_PATH'] ? { executablePath: process.env['PW_CHROMIUM_PATH'] } : {});
const page = await browser.newPage();
// tsx сохраняет имена функций через служебный __name — в браузере его нет
await page.setContent('<!doctype html><html><body></body></html>');
await page.evaluate('globalThis.__name = (fn) => fn');
for (const job of JOBS) {
  const dataUrl = await page.evaluate(generate, job);
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  writeFileSync(join(OUT, `${job.name}.webp`), bytes);
  console.info(`${job.name}: ${(bytes.length / 1000).toFixed(1)} КБ`);
}
await browser.close();
