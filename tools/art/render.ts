/**
 * Растрирование иллюстраций элементов: SVG из tools/art/elements → assets/elements/<id>.webp.
 *
 *   npm run art                    все иллюстрации серии
 *   npm run art -- water fire      только перечисленные
 *   npm run art -- --preview <dir> ещё и лист предпросмотра (PNG) в указанной папке
 *
 * Рисунок строится в Chromium (Playwright) с двукратным запасом разрешения и уменьшается
 * с качественным сглаживанием — так тонкая штриховка и частицы не «рвутся».
 * Готовые WebP коммитятся в репозиторий: сборка игры не зависит от браузера.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ELEMENT_ART } from './elements';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_SIZE = 256;
const QUALITY = 0.9;

let previewDir: string | undefined;
const ids: string[] = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--preview') previewDir = args[(i += 1)];
  else ids.push(args[i]!);
}
const selected = ELEMENT_ART.filter((art) => ids.length === 0 || ids.includes(art.id));
if (selected.length === 0) {
  console.error(`Нет иллюстраций для: ${ids.join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch(process.env['PW_CHROMIUM_PATH'] ? { executablePath: process.env['PW_CHROMIUM_PATH'] } : {});
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');

/** Рисует SVG в canvas нужного размера и возвращает data URL. */
async function rasterize(svgText: string, size: number, type: 'image/webp' | 'image/png'): Promise<string> {
  return page.evaluate(
    async ({ svgText, size, type, quality }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
      await image.decode();
      // Рисуем вдвое крупнее, затем уменьшаем: сглаживание мелких деталей
      const big = document.createElement('canvas');
      big.width = big.height = size * 2;
      big.getContext('2d')!.drawImage(image, 0, 0, size * 2, size * 2);
      const out = document.createElement('canvas');
      out.width = out.height = size;
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(big, 0, 0, size, size);
      return out.toDataURL(type, quality);
    },
    { svgText, size, type, quality: QUALITY },
  );
}

const decode = (dataUrl: string): Buffer => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

for (const art of selected) {
  const svgText = art.render();
  const webp = decode(await rasterize(svgText, OUTPUT_SIZE, 'image/webp'));
  const file = join(ROOT, 'assets/elements', `${art.id}.webp`);
  writeFileSync(file, webp);
  console.info(`${art.id}: ${(webp.length / 1000).toFixed(1)} КБ`);
  if (previewDir) {
    mkdirSync(previewDir, { recursive: true });
    writeFileSync(join(previewDir, `${art.id}.svg`), svgText);
  }
}

if (previewDir) {
  // Лист предпросмотра: каждый рисунок крупно и в игровых размерах на пергаменте
  const sources = await Promise.all(
    selected.map(async (art) => ({ id: art.id, url: await rasterize(art.render(), 512, 'image/png') })),
  );
  await page.setViewportSize({ width: 1400, height: 200 + 560 * Math.ceil(sources.length / 2) });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#e9d8b4;font:14px Georgia">
    <div style="display:grid;grid-template-columns:repeat(2,680px);gap:20px;padding:20px">
    ${sources
      .map(
        (s) => `<div style="background:#ead9b8;padding:10px;box-shadow:inset 0 0 40px rgb(120 84 40/.35)">
          <div>${s.id}</div><img src="${s.url}" width="400" height="400">
          <div style="display:flex;gap:18px;align-items:end">
            <img src="${s.url}" width="96" height="96"><img src="${s.url}" width="72" height="72">
            <img src="${s.url}" width="58" height="58"><img src="${s.url}" width="40" height="40">
          </div></div>`,
      )
      .join('')}
    </div></body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(previewDir, 'sheet.png'), fullPage: true });
  console.info(`Предпросмотр: ${join(previewDir, 'sheet.png')}`);
}

await browser.close();
