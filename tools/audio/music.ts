/**
 * Фоновая музыка «Ночь в лаборатории» — оригинальная композиция, синтезированная кодом.
 *
 *   npm run music
 *
 * Без чужих сэмплов и библиотек: волновые таблицы, фильтры, формантный хор, свёрточная реверберация.
 * Настроение — северное тёмное фэнтези: одиночество, холодная ночь, древнее каменное пространство.
 *
 * Форма (ре-дорийский / эолийский лад, 60 ударов в минуту, 16 аккордов по 8 секунд, цикл 128 с):
 *   1–4   бурдон, струнные, ветер, редкие колокола;
 *   5–8   вступают хор и низкие струнные;
 *   9–15  валторна ведёт три фразы, хор крепнет;
 *   16    всё стихает к разреженному началу — цикл замыкается.
 *
 * Бесшовный цикл: рендер на два с лишним оборота; в файл попадает второй оборот (он уже содержит
 * хвосты реверберации первого) с небольшим запасом по краям. Игра зацикливает его точками
 * loopStart = LEAD и loopEnd = LEAD + LOOP. Все непрерывные голоса имеют целое число периодов
 * за цикл, а события детерминированы — поэтому сигнал строго периодичен.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RATE = 44100;
/** Длина цикла, с. Должна совпадать с MUSIC_LOOP в src/audio. */
export const LOOP = 128;
/** Запас в начале файла перед точкой цикла, с. */
export const LEAD = 0.5;
/** Запас в конце файла после точки цикла, с. */
const TAIL = 1.5;
const RENDER = LOOP * 2 + LEAD + TAIL + 1;
const N = Math.ceil(RENDER * RATE);

const dry = new Float32Array(N);
const wet = new Float32Array(N);

// ---------- Утилиты ----------

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

const midi = (note: number): number => 440 * 2 ** ((note - 69) / 12);
/** Частота, дающая целое число периодов за цикл: непрерывный голос не щёлкает на стыке. */
const periodic = (frequency: number): number => Math.max(1, Math.round(frequency * LOOP)) / LOOP;

/** Таблица пилообразной волны с ограниченным числом гармоник (без наложения спектра). */
const TABLE_SIZE = 4096;
const tables = new Map<number, Float32Array>();
function sawTable(harmonics: number): Float32Array {
  const cached = tables.get(harmonics);
  if (cached) return cached;
  const table = new Float32Array(TABLE_SIZE + 1);
  for (let k = 1; k <= harmonics; k += 1) {
    // Смягчённая пила: верхние гармоники затухают быстрее 1/k — тембр смычковых, а не синтезатора
    const amp = 1 / k ** 1.15;
    for (let i = 0; i <= TABLE_SIZE; i += 1) table[i]! += amp * Math.sin((2 * Math.PI * k * i) / TABLE_SIZE);
  }
  let peak = 0;
  for (const v of table) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i <= TABLE_SIZE; i += 1) table[i]! /= peak;
  tables.set(harmonics, table);
  return table;
}

function harmonicsFor(frequency: number, limit = 16000): number {
  return Math.max(1, Math.min(80, Math.floor(limit / frequency)));
}

/** Фильтр с переменной частотой (TPT SVF): одновременно низкие частоты и полоса. */
class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private g = 0;
  private k = 1;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  set(cutoff: number, q: number): void {
    this.g = Math.tan((Math.PI * Math.min(cutoff, RATE * 0.45)) / RATE);
    this.k = 1 / q;
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }
  /** Возвращает [низкие, полоса]. */
  process(x: number): [number, number] {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    return [v2, v1];
  }
}

/** Плавная огибающая: атака и спад по косинусу, удержание между ними. */
function envelope(t: number, duration: number, attack: number, release: number): number {
  if (t < 0 || t > duration + release) return 0;
  const a = t < attack ? 0.5 - 0.5 * Math.cos((Math.PI * t) / attack) : 1;
  const r = t > duration ? 0.5 + 0.5 * Math.cos((Math.PI * (t - duration)) / release) : 1;
  return a * r;
}

/**
 * Событие повторяется в каждом обороте. voice() создаёт голос заново для каждого оборота:
 * фазы, фильтры и шум начинаются одинаково — поэтому обороты совпадают отсчёт в отсчёт.
 */
function forEachCycle(start: number, length: number, voice: () => (index: number, t: number) => void): void {
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const write = voice();
    const begin = Math.round((start + cycle * LOOP) * RATE);
    const count = Math.round(length * RATE);
    for (let n = 0; n < count; n += 1) {
      const index = begin + n;
      if (index < 0 || index >= N) continue;
      write(index, n / RATE);
    }
  }
}

// ---------- Голоса ----------

interface Bowed {
  note: number;
  start: number;
  duration: number;
  gain: number;
  attack: number;
  release: number;
  /** Сколько расстроенных голосов в ансамбле. */
  voices: number;
  cutoff: number;
  send: number;
  seed: number;
}

/** Смычковые: ансамбль расстроенных голосов, «дыхание» смычка в яркости и громкости. */
function bowed(v: Bowed): void {
  const base = midi(v.note);
  const table = sawTable(harmonicsFor(base, 9000));
  forEachCycle(v.start, v.duration + v.release, () => {
    const random = rng(v.seed);
    const detunes = Array.from({ length: v.voices }, (_, i) => (v.voices === 1 ? 0 : (i / (v.voices - 1) - 0.5) * 0.14));
    const phases = detunes.map(() => random());
    const rates = detunes.map(() => 4.6 + random() * 1.2);
    const vibratoPhases = detunes.map(() => random() * 6.28);
    const filter = new Svf();
    return (index, t) => {
      const env = envelope(t, v.duration, v.attack, v.release);
      if (env === 0) return;
      let sample = 0;
      for (let i = 0; i < detunes.length; i += 1) {
        const vibrato = 1 + 0.0018 * Math.sin(2 * Math.PI * rates[i]! * t + vibratoPhases[i]!) * Math.min(1, t / 1.5);
        const frequency = base * 2 ** (detunes[i]! / 12) * vibrato;
        phases[i] = (phases[i]! + frequency / RATE) % 1;
        const p = phases[i]! * TABLE_SIZE;
        const j = Math.floor(p);
        sample += table[j]! + (table[j + 1]! - table[j]!) * (p - j);
      }
      if ((index & 31) === 0) filter.set(v.cutoff * (0.55 + 0.45 * env), 0.7);
      const [low] = filter.process(sample / detunes.length);
      const out = low * env * v.gain;
      dry[index]! += out;
      wet[index]! += out * v.send;
    };
  });
}

/** Хор: формантная фильтрация «а»/«о», у каждого певца своё вибрато. */
function choir(note: number, start: number, duration: number, gain: number, seed: number): void {
  const base = midi(note);
  const table = sawTable(harmonicsFor(base, 7000));
  forEachCycle(start, duration + 3.5, () => {
    const random = rng(seed);
    const singers = 4;
    const voices = Array.from({ length: singers }, () => ({
      detune: (random() - 0.5) * 0.16,
      phase: random(),
      rate: 4.8 + random() * 1.0,
      vibratoPhase: random() * 6.28,
    }));
    const formants = [new Svf(), new Svf(), new Svf()];
    const breath = rng(seed + 7);
    return (index, t) => {
      const env = envelope(t, duration, 3, 3.5);
      if (env === 0) return;
      let source = 0;
      for (const voice of voices) {
        const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * voice.rate * t + voice.vibratoPhase) * Math.min(1, t / 2);
        voice.phase = (voice.phase + (base * 2 ** (voice.detune / 12) * vibrato) / RATE) % 1;
        const p = voice.phase * TABLE_SIZE;
        const j = Math.floor(p);
        source += table[j]! + (table[j + 1]! - table[j]!) * (p - j);
      }
      source = source / singers + (breath() - 0.5) * 0.08;
      if ((index & 63) === 0) {
        // Гласная медленно плывёт от «о» к «а» и обратно
        const vowel = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / Math.max(4, duration));
        formants[0]!.set(450 + 250 * vowel, 6);
        formants[1]!.set(800 + 350 * vowel, 8);
        formants[2]!.set(2700, 10);
      }
      const out = (formants[0]!.process(source)[1] * 1 + formants[1]!.process(source)[1] * 0.6 + formants[2]!.process(source)[1] * 0.2) * env * gain;
      dry[index]! += out * 0.6;
      wet[index]! += out * 0.9;
    };
  });
}

/** Валторна: мягкая медь, яркость растёт с атакой, лёгкий подъезд к ноте и позднее вибрато. */
function horn(note: number, start: number, duration: number, gain: number, seed: number): void {
  const base = midi(note);
  const table = sawTable(harmonicsFor(base, 6000));
  forEachCycle(start, duration + 0.6, () => {
    const random = rng(seed);
    let phase = random();
    const filter = new Svf();
    const breath = rng(seed + 3);
    const breathFilter = new Svf();
    breathFilter.set(1100, 1.2);
    return (index, t) => {
      const env = envelope(t, duration, 0.16, 0.6);
      if (env === 0) return;
      const scoop = t < 0.09 ? -0.3 * (1 - t / 0.09) : 0;
      const vibrato = t > 0.7 ? 0.003 * Math.sin(2 * Math.PI * 4.9 * t) * Math.min(1, (t - 0.7) / 0.8) : 0;
      phase = (phase + (base * 2 ** (scoop / 12) * (1 + vibrato)) / RATE) % 1;
      const p = phase * TABLE_SIZE;
      const j = Math.floor(p);
      const raw = table[j]! + (table[j + 1]! - table[j]!) * (p - j);
      if ((index & 15) === 0) filter.set(280 + 1300 * env ** 1.6, 0.85);
      const [low] = filter.process(raw);
      const air = breathFilter.process(breath() - 0.5)[1] * 0.05 * env;
      const out = (low + air) * env * gain;
      dry[index]! += out * 0.75;
      wet[index]! += out * 0.7;
    };
  });
}

/** Колокол: негармонические обертоны с долгим затуханием, мягкая атака без щелчка. */
function bell(note: number, start: number, gain: number): void {
  const base = midi(note);
  const partials: [number, number, number][] = [
    [1, 1, 4.5],
    [2.01, 0.45, 3],
    [2.76, 0.35, 2.4],
    [5.4, 0.12, 1.2],
    [8.93, 0.05, 0.6],
    [0.5, 0.25, 5],
  ];
  forEachCycle(start, 6, () => (index, t) => {
    const attack = Math.min(1, t / 0.004);
    let sample = 0;
    for (const [ratio, amp, decay] of partials) sample += Math.sin(2 * Math.PI * base * ratio * t) * amp * Math.exp(-t / decay);
    const out = sample * attack * gain * (t > 5.5 ? (6 - t) / 0.5 : 1);
    dry[index]! += out * 0.5;
    wet[index]! += out * 1.1;
  });
}

/** Арфа: щипковая струна по алгоритму Карплуса — Стронга (детерминированный шум возбуждения). */
function harp(note: number, start: number, gain: number, seed: number): void {
  const frequency = midi(note);
  const period = RATE / frequency;
  const size = Math.floor(period);
  const fraction = period - size;
  const line = new Float32Array(size + 2);
  const random = rng(seed);
  // Возбуждение: мягкий шум (сглаженный), чтобы атака была тёплой, а не металлической
  let previous = 0;
  for (let i = 0; i < line.length; i += 1) {
    previous = previous * 0.5 + (random() * 2 - 1) * 0.5;
    line[i] = previous;
  }
  const length = 5;
  const samples = new Float32Array(Math.round(length * RATE));
  let read = 0;
  for (let n = 0; n < samples.length; n += 1) {
    const a = line[read % line.length]!;
    const b = line[(read + 1) % line.length]!;
    const value = a + (b - a) * fraction;
    samples[n] = value;
    // Затухание и смягчение верхов с каждым проходом по струне
    line[read % line.length] = 0.4985 * (a + b);
    read += 1;
  }
  forEachCycle(start, length, () => (index, t) => {
    const n = Math.round(t * RATE);
    const fade = t > length - 0.4 ? (length - t) / 0.4 : 1;
    const out = (samples[n] ?? 0) * gain * fade;
    dry[index]! += out * 0.7;
    wet[index]! += out * 0.8;
  });
}

/** Бурдон на всём цикле: открытая квинта ре–ля и глубокий суббас, медленное «дыхание». */
function drone(): void {
  const notes: [number, number][] = [
    [38, 1],
    [45, 0.7],
    [26, 0.35],
  ];
  const tableFor = notes.map(([n]) => sawTable(harmonicsFor(midi(n), 2400)));
  const frequencies = notes.map(([n]) => [-1, 0, 1].map((d) => periodic(midi(n) + d * (12 / LOOP))));
  const phases = frequencies.map((set) => set.map((_, i) => i * 0.31));
  const filter = new Svf();
  const breathe = periodic(1 / 32);
  for (let index = 0; index < N; index += 1) {
    const t = index / RATE;
    let sample = 0;
    for (let k = 0; k < notes.length; k += 1) {
      const table = tableFor[k]!;
      for (let i = 0; i < 3; i += 1) {
        phases[k]![i] = (phases[k]![i]! + frequencies[k]![i]! / RATE) % 1;
        const p = phases[k]![i]! * TABLE_SIZE;
        const j = Math.floor(p);
        sample += (table[j]! + (table[j + 1]! - table[j]!) * (p - j)) * notes[k]![1];
      }
    }
    const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * breathe * t);
    if ((index & 63) === 0) filter.set(260 + 160 * swell, 0.7);
    const [low] = filter.process(sample / 6);
    const out = low * swell * 0.48;
    dry[index]! += out;
    wet[index]! += out * 0.35;
  }
}

/** Ночной ветер за окном: шум в медленно плывущей полосе, периодичный по циклу. */
function wind(): void {
  const filter = new Svf();
  const sweep = periodic(3 / LOOP);
  const swell = periodic(2 / LOOP);
  const period = LOOP * RATE;
  for (let index = 0; index < N; index += 1) {
    const t = index / RATE;
    // Детерминированный периодический шум: значение зависит только от позиции внутри цикла
    let h = Math.imul((index % period) ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    const noise = (h >>> 0) / 4294967296 - 0.5;
    if ((index & 63) === 0) filter.set(420 + 300 * Math.sin(2 * Math.PI * sweep * t), 1.6);
    const level = 0.5 + 0.5 * Math.sin(2 * Math.PI * swell * t - 1.2);
    const out = filter.process(noise)[1] * level * level * 0.09;
    dry[index]! += out;
    wet[index]! += out * 0.6;
  }
}

// ---------- Партитура ----------

const BEAT = 1;
const CHORD = 8 * BEAT;

/** Аккорды: [бас, голоса струнных]. 16 аккордов по 8 секунд. */
const CHORDS: [number, number[]][] = [
  [38, [50, 57, 62, 65]], // Dm
  [46, [50, 58, 62, 65]], // B♭
  [41, [53, 57, 60, 65]], // F
  [36, [52, 55, 60, 64]], // C
  [38, [50, 57, 62, 65]], // Dm
  [43, [50, 55, 58, 62]], // Gm
  [46, [53, 58, 62, 65]], // B♭
  [45, [52, 57, 62, 64]], // Asus4
  [38, [50, 57, 62, 65]], // Dm
  [46, [50, 58, 62, 65]], // B♭
  [43, [50, 55, 58, 62]], // Gm
  [36, [52, 55, 60, 64]], // C
  [41, [53, 57, 60, 65]], // F
  [46, [50, 55, 58, 62]], // Gm/B♭
  [45, [52, 57, 61, 64]], // A (из задержания)
  [38, [50, 57, 62, 65]], // Dm
];

/** Три фразы валторны: [нота, начало (доли), длительность (доли)]. */
const MELODY: [number, number, number][] = [
  // Фраза 1 — над Dm и B♭
  [69, 64, 2], [74, 66, 1.5], [72, 67.5, 0.5], [69, 68, 3],
  [67, 72, 1.5], [65, 73.5, 0.5], [67, 74, 1], [69, 75, 1], [65, 76, 2], [64, 78, 1], [62, 79, 4],
  // Фраза 2 — ответ над Gm и C
  [62, 86, 1], [65, 87, 1], [67, 88, 2], [70, 90, 1.5], [69, 91.5, 0.5], [67, 92, 2], [65, 94, 1], [64, 95, 3],
  // Фраза 3 — подъём и возвращение к тонике
  [69, 100, 2], [72, 102, 1], [74, 103, 3], [72, 106, 1], [69, 107, 1], [67, 108, 3],
  [65, 111, 1], [64, 112, 2], [67, 114, 1], [65, 115, 1], [64, 116, 2], [62, 120, 5],
];

const BELLS: [number, number, number][] = [
  [81, 6, 0.05], [86, 22, 0.035], [77, 38, 0.045], [81, 50, 0.04], [86, 70, 0.03], [77, 102, 0.04], [81, 118, 0.035],
];

function compose(): void {
  drone();
  wind();
  CHORDS.forEach(([bass, notes], i) => {
    const start = i * CHORD;
    // Струнные всё время, с плавной динамикой: чуть тише в начале и в конце цикла
    const dynamics = [0.85, 0.85, 0.88, 0.9, 0.92, 0.95, 0.97, 1, 1, 1, 1, 1, 1, 0.97, 0.92, 0.87][i]!;
    notes.forEach((note, k) =>
      bowed({ note, start, duration: CHORD, gain: 0.07 * dynamics, attack: 2.4, release: 3, voices: 3, cutoff: 1500, send: 0.55, seed: i * 10 + k }),
    );
    // Задержание в предпоследних аккордах: кварта разрешается в терцию
    if (i === 7) bowed({ note: 61, start: start + 4, duration: 4, gain: 0.05, attack: 1.5, release: 3, voices: 2, cutoff: 1400, send: 0.6, seed: 500 });
    // Низкие струнные и хор нарастают к середине формы и стихают к концу
    const bassLevel = [0, 0, 0, 0.04, 0.07, 0.09, 0.1, 0.11, 0.11, 0.11, 0.11, 0.11, 0.1, 0.09, 0.07, 0.04][i]!;
    if (bassLevel > 0) {
      bowed({ note: bass, start, duration: CHORD, gain: bassLevel, attack: 2.2, release: 2.8, voices: 2, cutoff: 700, send: 0.35, seed: 200 + i });
    }
    const choirLevel = [0, 0, 0, 0, 0.035, 0.05, 0.065, 0.08, 0.1, 0.1, 0.105, 0.1, 0.095, 0.08, 0.055, 0][i]!;
    if (choirLevel > 0) {
      choir(notes[2]! + 12, start + 0.5, CHORD - 0.5, choirLevel, 300 + i);
      choir(notes[1]! + 12, start + 0.5, CHORD - 0.5, choirLevel * 0.8, 400 + i);
    }
    // Арфа: медленные восходящие арпеджио в тихих частях — движение без суеты
    if (i <= 5 || i >= 13) {
      const pattern = [notes[0]! + 12, notes[1]! + 12, notes[2]! + 12, notes[3]! + 12, notes[2]! + 12, notes[1]! + 12];
      pattern.forEach((note, k) => {
        if (i >= 13 && k > 3) return;
        harp(note, start + k * 1.25 + (k % 2) * 0.08, 0.13 * (k === 0 ? 1 : 0.8), 900 + i * 10 + k);
      });
    }
  });
  MELODY.forEach(([note, start, length], i) => horn(note, start * BEAT, length * BEAT, 0.16, 700 + i));
  BELLS.forEach(([note, start, gain]) => bell(note, start, gain));
}

// ---------- Пространство: свёртка с синтетическим залом ----------

function fft(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k += 1) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      re[i]! /= n;
      im[i]! /= n;
    }
  }
}

/** Импульсная характеристика каменного зала: низы звучат дольше верхов, ранние отражения редкие. */
function hallImpulse(seconds: number): Float32Array {
  const length = Math.round(seconds * RATE);
  const ir = new Float32Array(length);
  const random = rng(4242);
  const low = new Svf();
  low.set(700, 0.7);
  const mid = new Svf();
  mid.set(2200, 0.7);
  const predelay = Math.round(0.03 * RATE);
  for (let i = predelay; i < length; i += 1) {
    const t = (i - predelay) / RATE;
    const noise = random() * 2 - 1;
    const [lowPart] = low.process(noise);
    const [midAll] = mid.process(noise);
    const midPart = midAll - lowPart;
    const highPart = noise - midAll;
    ir[i] = lowPart * Math.exp(-t / 1.3) + midPart * Math.exp(-t / 0.85) + highPart * Math.exp(-t / 0.35) * 0.4;
  }
  // Ранние отражения от каменных стен
  for (const [delay, amp] of [[0.019, 0.5], [0.031, -0.35], [0.047, 0.28], [0.063, -0.22], [0.081, 0.16]] as const) {
    ir[Math.round(delay * RATE)]! += amp;
  }
  let energy = 0;
  for (const v of ir) energy += v * v;
  const scale = 1 / Math.sqrt(energy);
  for (let i = 0; i < length; i += 1) ir[i]! *= scale;
  return ir;
}

function convolve(signal: Float32Array, ir: Float32Array): Float32Array {
  const size = 1 << 19;
  const block = size - ir.length + 1;
  const irRe = new Float64Array(size);
  const irIm = new Float64Array(size);
  irRe.set(ir);
  fft(irRe, irIm, false);
  const out = new Float32Array(signal.length);
  for (let start = 0; start < signal.length; start += block) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < block && start + i < signal.length; i += 1) re[i] = signal[start + i]!;
    fft(re, im, false);
    for (let i = 0; i < size; i += 1) {
      const r = re[i]! * irRe[i]! - im[i]! * irIm[i]!;
      im[i] = re[i]! * irIm[i]! + im[i]! * irRe[i]!;
      re[i] = r;
    }
    fft(re, im, true);
    for (let i = 0; i < size && start + i < out.length; i += 1) out[start + i]! += re[i]!;
  }
  return out;
}

// ---------- Сборка ----------

function wav(samples: Float32Array): Buffer {
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

const started = Date.now();
compose();
const reverb = convolve(wet, hallImpulse(4.5));
const mix = new Float32Array(N);
for (let i = 0; i < N; i += 1) mix[i] = dry[i]! * 0.8 + reverb[i]! * 0.55;

// Второй оборот с запасом: [LOOP − LEAD, 2·LOOP + TAIL)
const from = Math.round((LOOP - LEAD) * RATE);
const to = Math.round((LOOP * 2 + TAIL) * RATE);
const segment = mix.slice(from, to);
let peak = 0;
for (const v of segment) peak = Math.max(peak, Math.abs(v));
const target = 10 ** (-3 / 20);
for (let i = 0; i < segment.length; i += 1) segment[i]! *= target / peak;

const temp = join(tmpdir(), 'last-alchemist-music');
mkdirSync(temp, { recursive: true });
const source = join(temp, 'music.wav');
writeFileSync(source, wav(segment));
const outDir = join(ROOT, 'assets/audio');
mkdirSync(outDir, { recursive: true });
const output = join(outDir, 'music.mp3');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-codec:a', 'libmp3lame', '-b:a', '80k', '-ac', '1', output]);
const keep = process.argv.includes('--keep-wav');
if (keep) {
  mkdirSync(join(ROOT, 'review/local'), { recursive: true });
  writeFileSync(join(ROOT, 'review/local/music.wav'), wav(segment));
}
rmSync(temp, { recursive: true, force: true });
console.info(`music.mp3: цикл ${LOOP} с, запас ${LEAD} + ${TAIL} с, пик −3 дБ; ${((Date.now() - started) / 1000).toFixed(1)} с`);
