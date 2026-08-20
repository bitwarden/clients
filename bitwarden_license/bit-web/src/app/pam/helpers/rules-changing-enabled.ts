/**
 * The subset of `rules` that a set-enabled action would actually change: those not already in
 * the target state.
 *
 * One home for the skip rule, because two callers need it at different moments and must agree.
 * `AccessRulesService.setManyEnabled` applies it to decide what to send, while the list component
 * applies it *before* the round-trip to count what the confirmation dialog promises. Derived
 * separately they could drift, and the dialog would then overstate what the write did.
 */
export function rulesChangingEnabled<T extends { enabled: boolean }>(
  rules: readonly T[],
  enabled: boolean,
): T[] {
  return rules.filter((rule) => rule.enabled !== enabled);
}
