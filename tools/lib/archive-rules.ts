/**
 * Правила архива для загрузки в консоль Яндекс Игр.
 * Источник: требования к играм, пункты 1.21–1.22
 * https://yandex.com/dev/games/doc/en/concepts/requirements
 * - один ZIP, распакованный размер не более 100 МБ;
 * - index.html в корне архива;
 * - имена файлов и папок без пробелов и кириллицы.
 */

/** 100 МБ. Берём десятичные мегабайты — это строже двоичных (100 МиБ). */
export const MAX_UNPACKED_BYTES = 100 * 1000 * 1000;

/** Собственный ориентир проекта (docs/ARCHITECTURE.md): архив до 30 МБ. Превышение — предупреждение. */
export const BUDGET_UNPACKED_BYTES = 30 * 1000 * 1000;

/**
 * Разрешённые символы пути. Требование запрещает пробелы и кириллицу;
 * мы допускаем только безопасный ASCII, что исключает и их, и другие проблемные символы.
 */
const SAFE_PATH = /^[A-Za-z0-9._\-/]+$/;

export interface ArchiveEntry {
  /** Путь внутри архива через "/". Каталоги заканчиваются на "/". */
  path: string;
  /** Размер в распакованном виде, байт. */
  size: number;
}

export interface ArchiveReport {
  errors: string[];
  warnings: string[];
  fileCount: number;
  totalBytes: number;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} Б`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(1)} КБ`;
  return `${(bytes / 1000 / 1000).toFixed(2)} МБ`;
}

export function checkArchiveEntries(entries: readonly ArchiveEntry[]): ArchiveReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const files = entries.filter((entry) => !entry.path.endsWith('/'));
  const totalBytes = files.reduce((sum, entry) => sum + entry.size, 0);

  if (files.length === 0) errors.push('Архив пуст.');

  if (!files.some((entry) => entry.path === 'index.html')) {
    const nested = files.find((entry) => entry.path.endsWith('/index.html'));
    errors.push(
      nested
        ? `index.html должен лежать в корне архива, найден только "${nested.path}".`
        : 'В корне архива нет index.html.',
    );
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    const { path } = entry;
    if (path.startsWith('/') || path.split('/').includes('..')) {
      errors.push(`Недопустимый путь "${path}": абсолютный или с переходом вверх.`);
    }
    if (/\s/.test(path)) {
      errors.push(`Пробел в имени: "${path}".`);
    }
    if (/[Ѐ-ӿ]/.test(path)) {
      errors.push(`Кириллица в имени: "${path}".`);
    }
    if (!SAFE_PATH.test(path) && !/\s|[Ѐ-ӿ]/.test(path)) {
      errors.push(`Недопустимые символы в имени: "${path}". Разрешены A–Z, a–z, 0–9, ".", "_", "-".`);
    }
    const key = path.toLowerCase();
    if (seen.has(key)) errors.push(`Повторяющийся путь (без учёта регистра): "${path}".`);
    seen.add(key);
    if (path.endsWith('.map')) warnings.push(`В архив попала карта исходников: "${path}".`);
  }

  if (totalBytes > MAX_UNPACKED_BYTES) {
    errors.push(
      `Распакованный размер ${formatBytes(totalBytes)} превышает лимит ${formatBytes(MAX_UNPACKED_BYTES)}.`,
    );
  } else if (totalBytes > BUDGET_UNPACKED_BYTES) {
    warnings.push(
      `Распакованный размер ${formatBytes(totalBytes)} больше бюджета проекта ${formatBytes(BUDGET_UNPACKED_BYTES)}.`,
    );
  }

  return { errors, warnings, fileCount: files.length, totalBytes };
}

/**
 * Проверка index.html: все ссылки на ресурсы относительные (игра открывается из архива),
 * кроме SDK площадки /sdk.js, который по документации подключается абсолютным путём.
 */
export function checkIndexHtml(html: string, { expectSdk }: { expectSdk: boolean }): ArchiveReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const references = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1] ?? '');

  for (const ref of references) {
    if (ref === '/sdk.js') continue;
    if (/^(?:https?:)?\/\//i.test(ref)) {
      errors.push(`Внешняя ссылка в index.html: "${ref}". Ресурсы должны лежать в архиве.`);
    } else if (ref.startsWith('/')) {
      errors.push(`Абсолютный путь в index.html: "${ref}". Нужен относительный ("./...").`);
    }
  }

  const hasSdk = references.includes('/sdk.js');
  if (expectSdk && !hasSdk) errors.push('В index.html не подключён SDK Яндекс Игр (/sdk.js).');
  if (!expectSdk && hasSdk) warnings.push('В index.html подключён /sdk.js, хотя сборка не для Яндекс Игр.');

  return { errors, warnings, fileCount: 0, totalBytes: 0 };
}
