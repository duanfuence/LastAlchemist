import type { ContentPack } from '../content/types';
import { regularComplete } from './exploration';
import type { Progress } from './progress';

/**
 * Сюжетные записи книги — два последовательных события:
 * - research — открыты все обычные элементы: книга заполнена, но на полях зачёркнута одна запись;
 * - final — к тому же найден тайный элемент: история эксперимента завершена.
 * Финал требует обоих условий: если Гомункул найден раньше, чем вся книга, финал наступит,
 * когда будет сделан последний обычный опыт (сразу после записи research).
 */
export const STORY_ENTRIES = ['research', 'final'] as const;
export type StoryEntryId = (typeof STORY_ENTRIES)[number];

export function isStoryEntry(value: string): value is StoryEntryId {
  return (STORY_ENTRIES as readonly string[]).includes(value);
}

/** Записи, условия которых выполнены при данном прогрессе (в порядке книги). */
export function reachedStory(content: ContentPack, progress: Progress): StoryEntryId[] {
  if (!regularComplete(content, progress)) return [];
  const secrets = [...content.elements.values()].filter((element) => element.secret);
  const allSecrets = secrets.length > 0 && secrets.every((element) => progress.discovered.includes(element.id));
  return allSecrets ? ['research', 'final'] : ['research'];
}
