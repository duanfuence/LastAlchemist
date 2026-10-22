import { createBrowserSoundSystem, type SoundName, type SoundSystem } from './SoundSystem';

export type { SoundName, SoundSettings, SoundSystem } from './SoundSystem';

/** Файлы звуков из assets/audio (синтезируются скриптом tools/audio/synth.ts). */
const FILES = import.meta.glob<string>('../../assets/audio/*.mp3', { query: '?url', import: 'default', eager: true });

export function createSoundSystem(): SoundSystem {
  const urls: Partial<Record<SoundName, string>> = {};
  for (const [path, url] of Object.entries(FILES)) {
    const name = path.slice(path.lastIndexOf('/') + 1, -'.mp3'.length) as SoundName;
    urls[name] = url;
  }
  return createBrowserSoundSystem(urls);
}
