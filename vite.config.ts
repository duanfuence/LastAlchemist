import { defineConfig, type Plugin } from 'vite';

/**
 * Режим сборки 'yandex' подключает SDK Яндекс Игр так, как описано в официальной документации:
 * <script src="/sdk.js"> — относительный путь, файл отдаёт сама площадка.
 * https://yandex.com/dev/games/doc/en/sdk/sdk-about
 * В режиме разработки SDK не подключается, игра работает на локальной платформе.
 */
function yandexSdk(): Plugin {
  return {
    name: 'last-alchemist:yandex-sdk',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{ tag: 'script', attrs: { src: '/sdk.js' }, injectTo: 'head-prepend' }],
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Относительные пути: игра открывается из архива в iframe площадки
  base: './',
  plugins: mode === 'yandex' ? [yandexSdk()] : [],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    assetsDir: 'assets',
    reportCompressedSize: true,
  },
  server: {
    host: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
