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

import { loadContent } from './content';
import { GameSession } from './game/GameSession';
import { createTranslator, resolveLocale } from './i18n';
import { LocalSaveStore, getBrowserStorage } from './persistence/LocalSaveStore';
import { createPlatform } from './platform';
import { installArtDefinitions } from './ui/art';
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

  // На первом этапе игра только на русском; язык площадки подключим вместе с английским.
  const i18n = createTranslator(resolveLocale(document.documentElement.lang));
  document.title = i18n.t('app.title');

  // Интерфейс рисуется сразу, SDK инициализируется параллельно.
  const platformReady = createPlatform({
    target: import.meta.env.MODE === 'yandex' ? 'yandex' : 'local',
    visibility: document,
  });

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

  book = new Book(i18n, {
    createLab: (onExit) => new LabView({ session, i18n, onExit }),
  });
  root.replaceChildren(book.root);
  book.show('title');
  if (session.loadStatus === 'corrupted') book.notify(i18n.t('notice.corrupted'));
  if (store.unavailable) book.notify(i18n.t('notice.storageUnavailable'));

  const platform = await platformReady;
  platform.onPauseChange((paused) => {
    document.documentElement.toggleAttribute('data-paused', paused);
  });
  document.documentElement.dataset['platform'] = platform.kind;

  await loadFonts();
  platform.gameReady();
  document.documentElement.dataset['ready'] = 'true';
}

bootstrap().catch((error: unknown) => {
  console.error('Не удалось запустить игру', error);
  const root = document.getElementById('app');
  if (root) {
    root.textContent = 'Не удалось открыть книгу. Обновите страницу.';
    root.classList.add('boot-error');
  }
});
