/** Shared so `setManyEnabled` sends the same rules the confirmation dialog counted. */
export function rulesChangingEnabled<T extends { enabled: boolean }>(
  rules: readonly T[],
  enabled: boolean,
): T[] {
  return rules.filter((rule) => rule.enabled !== enabled);
}
