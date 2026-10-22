import type { ContentPack, RecipeDef } from '../content/types';
import { orderedKey, unorderedKey } from './keys';

export type LookupResult =
  | { kind: 'recipe'; recipe: RecipeDef }
  | { kind: 'none' }
  | { kind: 'unknown-element'; id: string };

/**
 * Индекс рецептов. Поиск детерминирован:
 * 1) упорядоченный рецепт для (первый, второй);
 * 2) неупорядоченный рецепт для пары в любом порядке.
 * Проверка базы запрещает для одной пары одновременно упорядоченный и неупорядоченный рецепт,
 * поэтому порядок поиска не влияет на результат корректной базы.
 */
export class RecipeBook {
  private readonly byKey = new Map<string, RecipeDef>();
  private readonly byOutput = new Map<string, RecipeDef[]>();

  constructor(private readonly content: ContentPack) {
    for (const recipe of content.recipes) {
      // При конфликте побеждает первый рецепт; конфликт всё равно отклоняется проверкой базы
      if (!this.byKey.has(recipe.key)) this.byKey.set(recipe.key, recipe);
      const list = this.byOutput.get(recipe.output) ?? [];
      list.push(recipe);
      this.byOutput.set(recipe.output, list);
    }
  }

  /** first — переносимый (или выбранный первым) элемент, second — цель. */
  find(first: string, second: string): LookupResult {
    for (const id of [first, second]) {
      if (!this.content.elements.has(id)) return { kind: 'unknown-element', id };
    }
    const recipe = this.byKey.get(orderedKey(first, second)) ?? this.byKey.get(unorderedKey(first, second));
    return recipe ? { kind: 'recipe', recipe } : { kind: 'none' };
  }

  /** Все рецепты, дающие элемент (для энциклопедии и подсказок). */
  recipesFor(elementId: string): readonly RecipeDef[] {
    return this.byOutput.get(elementId) ?? [];
  }
}
