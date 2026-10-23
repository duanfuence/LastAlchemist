import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/cyrillic-500-italic.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/cyrillic-700.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/marck-script/cyrillic-400.css';
import '@fontsource/marck-script/latin-400.css';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/art.css';
import './ui/styles/book.css';
import './ui/styles/screens.css';
import './ui/styles/lab.css';

import { createSoundSystem } from './audio';
import { loadContent } from './content';
import { GameSession } from './game/GameSession';
import { createTranslator, resolveLocale } from './i18n';
import { LocalSaveStore, getBrowserStorage } from './persistence/LocalSaveStore';
import { createPlatform } from './platform';
import { PauseState } from './platform/Platform';
import { installArtDefinitions } from './ui/art';
import { Atmosphere } from './ui/Atmosphere';
import { Book } from './ui/Book';
import { blockBrowserGestures } from './ui/guards';
import { LabView } from './ui/lab/LabView';

const FONT_WAIT_LIMIT_MS = 2500;

/**
 * Все начертания, которые использует книга. Загружаются явно до LoadingAPI.ready(),
 * иначе браузер скачает шрифт только при первом появлении текста и страница «мигнёт».
 * Образец текста задействует и кириллический, и латинский наборы.
 */
const FONT_FACES = [
  '500 1em "Cormorant Garamond"',
  'italic 500 1em "Cormorant Garamond"',
  '700 1em "Cormorant Garamond"',
  '400 1em "Marck Script"',
];
const FONT_SAMPLE = 'Книга Aa';

async function loadFonts(): Promise<void> {
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_LIMIT_MS));
  const loading = Promise.allSettled(FONT_FACES.map((face) => document.fonts.load(face, FONT_SAMPLE)));
  // Шрифт — не причина задерживать игру: по таймауту продолжаем с запасными шрифтами
  await Promise.race([loading, timeout]);
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('Не найден контейнер #app');

  blockBrowserGestures();
  installArtDefinitions();

  // Шрифты грузятся параллельно с SDK площадки
  const fontsReady = loadFonts();
  // Язык определяется при запуске через SDK площадки (требование Яндекс Игр 2.14), поэтому
  // текст появляется после инициализации SDK. Без площадки — язык документа.
  // Поддерживается только русский: любой другой язык площадки показывает русский интерфейс.
  const platform = await createPlatform({
    target: import.meta.env.MODE === 'yandex' ? 'yandex' : 'local',
    visibility: document,
  });
  const i18n = createTranslator(resolveLocale(platform.language ?? document.documentElement.lang));
  document.documentElement.lang = i18n.locale;
  document.title = i18n.t('app.title');

  // База рецептов проверяется при сборке (npm run content:check); здесь — страховка для разработки
  const { pack, issues } = loadContent();
  for (const issue of issues) console.error('Ошибка базы контента:', issue.message);

  let book: Book | null = null;
  const store = new LocalSaveStore(getBrowserStorage(), 400, () => {
    book?.notify(i18n.t('notice.storageUnavailable'));
  });
  const session = new GameSession(pack, store);
  // Незаписанный прогресс сохраняется при сворачивании и закрытии страницы
  const flush = (): void => session.flush();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });

  // Звук: контекст создаётся только жестом игрока; до этого игра молчит
  const sound = createSoundSystem();
  const unlockSound = (): void => {
    void sound.unlock();
  };
  for (const type of ['pointerdown', 'keydown', 'touchend', 'click']) {
    document.addEventListener(type, unlockSound, { capture: true });
  }

  const atmosphere = new Atmosphere(getBrowserStorage());
  book = new Book(i18n, {
    createLab: (onExit) => new LabView({ session, i18n, sound, atmosphere, onExit }),
    sound,
    atmosphere,
  });
  root.replaceChildren(book.root);
  book.show('title');
  if (session.loadStatus === 'corrupted') book.notify(i18n.t(session.readOnly ? 'notice.corruptedReadOnly' : 'notice.corrupted'));
  if (session.loadStatus === 'newer') book.notify(i18n.t('notice.newerSave'));
  if (store.unavailable) book.notify(i18n.t('notice.storageUnavailable'));

  // Пауза площадки и скрытая вкладка останавливают и анимации, и звук.
  // Потеря фокуса (щелчок вне игры, другое окно) — только звук: требование площадки касается звука.
  const soundPause = new PauseState();
  const applyPlatformPause = (paused: boolean): void => {
    document.documentElement.toggleAttribute('data-paused', paused);
    soundPause.set('platform', paused);
  };
  applyPlatformPause(platform.paused);
  platform.onPauseChange(applyPlatformPause);
  soundPause.trackFocus({
    hasFocus: () => document.hasFocus(),
    addEventListener: (type, listener) => window.addEventListener(type, listener),
  });
  soundPause.subscribe((paused) => sound.setPaused(paused));
  sound.setPaused(soundPause.paused);
  document.documentElement.dataset['platform'] = platform.kind;

  await fontsReady;
  platform.gameReady();
  document.documentElement.dataset['ready'] = 'true';
  // Звуки скачиваются после готовности игры, чтобы не мешать первой загрузке
  sound.prefetch();
}

bootstrap().catch((error: unknown) => {
  console.error('Не удалось запустить игру', error);
  const root = document.getElementById('app');
  if (root) {
    root.textContent = 'Не удалось открыть книгу. Обновите страницу.';
    root.classList.add('boot-error');
  }
});
