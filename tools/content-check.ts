/**
 * Проверка базы элементов и рецептов: npm run content:check
 * Ошибки (код выхода 1): дубликаты, несуществующие ссылки, конфликты рецептов,
 * недостижимые элементы, некорректные начальные элементы, нет текстов или иллюстраций.
 */
import { validateContent } from '../src/core/content/validate';
import { readContentFromDisk } from './lib/read-content';

const { assembled, options } = readContentFromDisk();
const report = validateContent(assembled.pack, options);
const { stats } = report;

console.info('Проверка базы контента');
console.info(
  `  элементов: ${stats.elements} (начальных ${stats.starting}, секретных ${stats.secret}), рецептов: ${stats.recipes}`,
);
const maxDepth = Math.max(0, ...stats.depth.values());
console.info(`  самая длинная цепочка: ${maxDepth} соединений`);
for (let level = 1; level <= maxDepth; level += 1) {
  const ids = [...stats.depth].filter(([, d]) => d === level).map(([id]) => id);
  console.info(`    шаг ${level}: ${ids.join(', ')}`);
}
for (const warning of report.warnings) console.warn(`  ПРЕДУПРЕЖДЕНИЕ: ${warning}`);
for (const error of report.errors) console.error(`  ОШИБКА: ${error}`);
console.info(report.errors.length === 0 ? '  Результат: база корректна.' : `  Результат: ошибок — ${report.errors.length}.`);
process.exitCode = report.errors.length === 0 ? 0 : 1;
