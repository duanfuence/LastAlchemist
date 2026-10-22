/** Ключ неупорядоченной пары: порядок ID не важен ("fire|water"). */
export function unorderedKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

/** Ключ упорядоченной пары: сначала переносимый (выбранный первым) элемент, затем цель ("a>b"). */
export function orderedKey(first: string, second: string): string {
  return `${first}>${second}`;
}

export function recipeKey(inputs: readonly [string, string], ordered: boolean): string {
  return ordered ? orderedKey(inputs[0], inputs[1]) : unorderedKey(inputs[0], inputs[1]);
}
