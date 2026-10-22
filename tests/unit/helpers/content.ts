import { assembleContent } from '../../../src/core/content/assemble';
import type { ContentPack } from '../../../src/core/content/types';

export interface MiniElement {
  id: string;
  starting?: boolean;
  secret?: boolean;
  final?: boolean;
  category?: string;
  art?: string;
}

/** Небольшая база для тестов. По умолчанию — четыре стихии и пара рецептов. */
export function makeFiles(
  elements: MiniElement[],
  recipes: { in: unknown; out: unknown; ordered?: boolean }[],
): Parameters<typeof assembleContent>[0] {
  return {
    elements: {
      'test/elements.json': elements.map((e) => ({
        category: 'test',
        art: `elements/${e.id}.svg`,
        ...e,
      })),
    },
    recipes: { 'test/recipes.json': recipes },
    categories: [{ id: 'test', order: 1 }],
  };
}

export function makePack(
  elements: MiniElement[],
  recipes: { in: unknown; out: unknown; ordered?: boolean }[],
): ContentPack {
  return assembleContent(makeFiles(elements, recipes)).pack;
}

export const BASIC_ELEMENTS: MiniElement[] = [
  { id: 'water', starting: true },
  { id: 'fire', starting: true },
  { id: 'earth', starting: true },
  { id: 'air', starting: true },
  { id: 'steam' },
  { id: 'cloud', final: true },
  { id: 'sea', final: true },
  { id: 'secret_stone', secret: true, final: true },
];

export const BASIC_RECIPES = [
  { in: ['water', 'fire'], out: 'steam' },
  { in: ['steam', 'air'], out: 'cloud' },
  { in: ['water', 'water'], out: 'sea' },
  { in: ['earth', 'steam'], out: 'secret_stone' },
];
