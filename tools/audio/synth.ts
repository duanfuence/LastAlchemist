/**
 * Звуки книги — синтезируются кодом, без чужих сэмплов и внешних библиотек.
 *
 *   npm run audio
 *
 * Каждый звук — короткая сумма простых источников (шум, синусоиды с огибающей), мягкие фильтры
 * и общий ревербератор Шрёдера, дающий ощущение комнаты. Высокие частоты срезаны:
 * звуки должны быть тихими и тёплыми, а не звенящими. Результат — моно MP3 в assets/audio
 * (ffmpeg с libmp3lame). Пиковый уровень нормирован к −4 дБ, громкость задаёт игра.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets/audio');
const RATE = 44100;

type Buffer32 = Float32Array;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buffer = (seconds: number): Buffer32 => new Float32Array(Math.round(seconds * RATE));

/** Добавляет src в dst со сдвигом и множителем. */
function mix(dst: Buffer32, src: Buffer32, at = 0, gain = 1): void {
  const offset = Math.round(at * RATE);
  for (let i = 0; i < src.length && offset + i < dst.length; i += 1) dst[offset + i]! += src[i]! * gain;
}

/** Огибающая: быстрая атака, экспоненциальное затухание. */
function envelope(length: number, attack: number, decay: number): Buffer32 {
  const out = new Float32Array(length);
  const a = Math.max(1, Math.round(attack * RATE));
  for (let i = 0; i < length; i += 1) {
    out[i] = i < a ? i / a : Math.exp(-(i - a) / (decay * RATE));
  }
  return out;
}

/** Тон с плавно меняющейся частотой и набором обертонов [множитель, громкость, затухание]. */
function tone(seconds: number, freq: (t: number) => number, partials: [number, number, number][], attack = 0.004): Buffer32 {
  const out = buffer(seconds);
  for (const [ratio, gain, decay] of partials) {
    const env = envelope(out.length, attack, decay);
    let phase = 0;
    for (let i = 0; i < out.length; i += 1) {
      phase += (2 * Math.PI * freq(i / RATE) * ratio) / RATE;
      out[i]! += Math.sin(phase) * gain * env[i]!;
    }
  }
  return out;
}

function noise(seconds: number, seed: number): Buffer32 {
  const random = rng(seed);
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i += 1) out[i] = random() * 2 - 1;
  return out;
}

/** Двухполюсный полосовой фильтр (RBJ), частота может меняться во времени. */
function bandpass(input: Buffer32, freq: (t: number) => number, q: number): Buffer32 {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const w = (2 * Math.PI * freq(i / RATE)) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w)) / a0;
    const a2 = (1 - alpha) / a0;
    const x = input[i]!;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** Однополюсный фильтр нижних частот — смягчает верх. */
function lowpass(input: Buffer32, cutoff: number): Buffer32 {
  const out = new Float32Array(input.length);
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < input.length; i += 1) {
    y += k * (input[i]! - y);
    out[i] = y;
  }
  return out;
}

function multiply(input: Buffer32, env: Buffer32): Buffer32 {
  return input.map((v, i) => v * (env[i] ?? 0));
}

/** Ревербератор Шрёдера: четыре гребенчатых и два всепропускающих фильтра. */
function reverb(input: Buffer32, wet: number, size = 1): Buffer32 {
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round(d * size));
  const out = new Float32Array(input.length);
  for (const delay of combs) {
    const line = new Float32Array(delay);
    let index = 0;
    let store = 0;
    for (let i = 0; i < input.length; i += 1) {
      const y = line[index]!;
      store = y * 0.8 + store * 0.2;
      line[index] = input[i]! + store * 0.82;
      index = (index + 1) % delay;
      out[i]! += y / combs.length;
    }
  }
  let signal = out;
  for (const delay of [225, 556]) {
    const line = new Float32Array(delay);
    const next = new Float32Array(signal.length);
    let index = 0;
    for (let i = 0; i < signal.length; i += 1) {
      const buffered = line[index]!;
      const y = -signal[i]! + buffered;
      line[index] = signal[i]! + buffered * 0.5;
      index = (index + 1) % delay;
      next[i] = y;
    }
    signal = next;
  }
  return input.map((v, i) => v * (1 - wet * 0.5) + signal[i]! * wet);
}

/** Плавное затухание в конце, чтобы не было щелчка. */
function fadeOut(input: Buffer32, seconds = 0.05): Buffer32 {
  const n = Math.round(seconds * RATE);
  for (let i = 0; i < n && i < input.length; i += 1) input[input.length - 1 - i]! *= i / n;
  return input;
}

function normalize(input: Buffer32, peakDb = -4): Buffer32 {
  const peak = input.reduce((max, v) => Math.max(max, Math.abs(v)), 0) || 1;
  const target = 10 ** (peakDb / 20);
  return input.map((v) => (v / peak) * target);
}

// ---------- Звуки ----------

/** Элемент ложится на страницу: мягкий шорох бумаги и глухой стук. */
function place(): Buffer32 {
  const out = buffer(0.32);
  const rustle = multiply(bandpass(noise(0.12, 1), () => 1800, 0.9), envelope(Math.round(0.12 * RATE), 0.004, 0.03));
  mix(out, rustle, 0, 0.6);
  mix(out, tone(0.25, (t) => 150 - t * 160, [[1, 1, 0.05], [2.1, 0.25, 0.03]]), 0, 0.8);
  return reverb(lowpass(out, 3500), 0.18, 0.6);
}

/** Начало реакции: короткий вздох жидкости с пузырьками. */
function react(): Buffer32 {
  const out = buffer(0.6);
  const swellEnv = new Float32Array(Math.round(0.35 * RATE)).map((_, i, arr) => Math.sin((i / arr.length) * Math.PI) ** 2);
  const swell = multiply(bandpass(noise(0.35, 2), (t) => 500 + t * 5000, 1.4), swellEnv);
  mix(out, swell, 0, 0.35);
  const random = rng(5);
  for (let k = 0; k < 4; k += 1) {
    const base = 380 + random() * 280;
    const bubble = tone(0.07, (t) => base * (1 + t * 14), [[1, 1, 0.025]], 0.002);
    mix(out, bubble, 0.05 + k * 0.07 + random() * 0.03, 0.35);
  }
  return fadeOut(reverb(lowpass(out, 4200), 0.25, 0.7));
}

/** Неудача: тихий деревянный стук с опускающимся тоном. */
function fail(): Buffer32 {
  const out = buffer(0.42);
  mix(out, tone(0.35, (t) => 210 - t * 120, [[1, 1, 0.06], [1.48, 0.4, 0.04], [2.3, 0.15, 0.02]]), 0, 0.8);
  mix(out, tone(0.3, (t) => 150 - t * 60, [[1, 1, 0.07]]), 0.07, 0.6);
  const tick = multiply(bandpass(noise(0.04, 3), () => 900, 1.2), envelope(Math.round(0.04 * RATE), 0.001, 0.008));
  mix(out, tick, 0, 0.4);
  return fadeOut(reverb(lowpass(out, 2400), 0.15, 0.6));
}

/** Стеклянный колокольчик: негармонические обертоны, как у бокала или чаши. */
function glass(freq: number, seconds: number, decay: number): Buffer32 {
  return tone(seconds, () => freq, [
    [1, 1, decay],
    [2.76, 0.32, decay * 0.45],
    [5.4, 0.1, decay * 0.22],
    [1.003, 0.5, decay * 0.9],
  ], 0.006);
}

/** Новое открытие: три мягких стеклянных звука, восходящее мажорное трезвучие. */
function discover(): Buffer32 {
  const out = buffer(2.1);
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => mix(out, glass(freq, 1.9 - i * 0.08, 0.55), i * 0.085, 0.5));
  mix(out, glass(1046.5, 1.4, 0.4), 0.26, 0.18);
  return fadeOut(reverb(lowpass(out, 5200), 0.38, 1.1), 0.2);
}

/** Тайное открытие: низкая чаша и мерцающее восхождение выше. */
function secret(): Buffer32 {
  const out = buffer(3.2);
  mix(out, tone(3, () => 196, [[1, 1, 1.3], [2.0, 0.35, 0.9], [2.98, 0.22, 0.6], [4.2, 0.08, 0.35], [1.004, 0.6, 1.2]], 0.02), 0, 0.7);
  const notes = [783.99, 987.77, 1174.66, 1567.98];
  notes.forEach((freq, i) => {
    const shimmer = glass(freq, 2.2, 0.7);
    // Мерцание: лёгкая амплитудная модуляция
    for (let k = 0; k < shimmer.length; k += 1) shimmer[k]! *= 0.8 + 0.2 * Math.sin((2 * Math.PI * 5.5 * k) / RATE + i);
    mix(out, shimmer, 0.18 + i * 0.13, 0.28);
  });
  return fadeOut(reverb(lowpass(out, 5200), 0.5, 1.3), 0.4);
}

/** Книга: шелест переворачиваемой страницы и мягкий удар обложки. */
function book(): Buffer32 {
  const out = buffer(0.7);
  const length = Math.round(0.42 * RATE);
  const flutter = new Float32Array(length).map((_, i) => {
    const t = i / length;
    return Math.sin(t * Math.PI) ** 1.5 * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 11));
  });
  const rustle = multiply(bandpass(noise(0.42, 4), (t) => 1200 + t * 5000, 0.7), flutter);
  mix(out, rustle, 0, 0.55);
  mix(out, tone(0.25, (t) => 110 - t * 50, [[1, 1, 0.06], [2.2, 0.2, 0.03]]), 0.36, 0.7);
  return fadeOut(reverb(lowpass(out, 4800), 0.2, 0.8));
}

const SOUNDS: Record<string, () => Buffer32> = { place, react, fail, discover, secret, book };

function wav(samples: Buffer32): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync(OUT, { recursive: true });
const temp = join(tmpdir(), 'last-alchemist-audio');
mkdirSync(temp, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) {
  const source = join(temp, `${name}.wav`);
  writeFileSync(source, wav(normalize(make())));
  const target = join(OUT, `${name}.mp3`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-codec:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', target]);
  console.info(`${name}.mp3`);
}
rmSync(temp, { recursive: true, force: true });
