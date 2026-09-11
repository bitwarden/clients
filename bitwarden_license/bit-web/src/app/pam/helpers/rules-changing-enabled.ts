/**
 * The subset of `rules` that a set-enabled action would actually change: those not already in
 * the target state.
 *
 * One home for the skip rule, since two callers need it and must agree: `setManyEnabled` uses
 * it to decide what to send, the list component uses it before the round-trip to count what the
 * confirmation dialog promises.
 */
export function rulesChangingEnabled<T extends { enabled: boolean }>(
  rules: readonly T[],
  enabled: boolean,
): T[] {
  return rules.filter((rule) => rule.enabled !== enabled);
}
