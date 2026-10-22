import { createBrowserSoundSystem, type SoundName, type SoundSystem } from './SoundSystem';

export type { SoundName, SoundSettings, SoundSystem } from './SoundSystem';

/** Файлы звуков из assets/audio (эффекты — tools/audio/synth.ts, музыка — tools/audio/music.ts). */
const FILES = import.meta.glob<string>('../../assets/audio/*.mp3', { query: '?url', import: 'default', eager: true });

/**
 * Бесшовный цикл музыки: в файле перед циклом 0,5 с запаса, затем ровно 128 с цикла
 * (совпадает с LEAD и LOOP в tools/audio/music.ts).
 */
export const MUSIC_LOOP_START = 0.5;
export const MUSIC_LOOP_END = MUSIC_LOOP_START + 128;

export function createSoundSystem(): SoundSystem {
  const urls: Partial<Record<SoundName, string>> = {};
  let music: string | undefined;
  for (const [path, url] of Object.entries(FILES)) {
    const name = path.slice(path.lastIndexOf('/') + 1, -'.mp3'.length);
    if (name === 'music') music = url;
    else urls[name as SoundName] = url;
  }
  return createBrowserSoundSystem(
    urls,
    music ? { url: music, loopStart: MUSIC_LOOP_START, loopEnd: MUSIC_LOOP_END } : undefined,
  );
}
