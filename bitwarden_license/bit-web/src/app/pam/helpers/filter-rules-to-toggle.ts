/** The rules whose `enabled` differs from `target`, i.e. the ones setting it would change. */
export function filterRulesToToggle<T extends { enabled: boolean }>(
  rules: readonly T[],
  target: boolean,
): T[] {
  return rules.filter((rule) => rule.enabled !== target);
}
