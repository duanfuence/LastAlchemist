import { formatBytes, type ArchiveReport } from './archive-rules';

/** Печатает отчёт проверки. Возвращает true, если ошибок нет. */
export function printReport(title: string, report: ArchiveReport, archiveBytes?: number): boolean {
  console.info(`\n${title}`);
  console.info(`  файлов: ${report.fileCount}`);
  console.info(`  распакованный размер: ${formatBytes(report.totalBytes)}`);
  if (archiveBytes !== undefined) console.info(`  размер архива: ${formatBytes(archiveBytes)}`);
  for (const warning of report.warnings) console.warn(`  ПРЕДУПРЕЖДЕНИЕ: ${warning}`);
  for (const error of report.errors) console.error(`  ОШИБКА: ${error}`);
  const ok = report.errors.length === 0;
  console.info(ok ? '  Результат: проверка пройдена.' : `  Результат: ошибок — ${report.errors.length}.`);
  return ok;
}
