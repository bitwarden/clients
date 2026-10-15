import type { AccessRuleAddEditRequest, AccessRuleView } from "../abstractions/access-rule";

import { ACCESS_RULE_NAME_MAX_LENGTH, accessRuleToRequest } from "./access-rule-request";

const PLAIN_SUFFIX_KEY = "pamAccessRuleDuplicateName";
const NUMBERED_SUFFIX_KEY = "pamAccessRuleDuplicateNameNumbered";

/** A narrowing of `I18nService.t` to the two copy-name templates this helper renders. */
export type CopyNameTranslator = (key: string, name: string, count?: number) => string;

/**
 * A copy name not in `takenNames`, compared case-insensitively like the server. The copy is created
 * before any form opens, so collisions get numbered rather than left for the admin to fix.
 */
export function copyRuleName(
  sourceName: string,
  takenNames: readonly string[],
  t: CopyNameTranslator,
): string {
  const taken = new Set(takenNames.map((name) => name.toLowerCase()));
  const candidate = (n?: number) =>
    withinNameLimit(
      (base) => (n == null ? t(PLAIN_SUFFIX_KEY, base) : t(NUMBERED_SUFFIX_KEY, base, n)),
      sourceName,
    );

  let name = candidate();
  for (let n = 2; taken.has(name.toLowerCase()) && n <= taken.size + 1; n++) {
    name = candidate(n);
  }
  return name;
}

/**
 * Shortens `base` rather than the rendered suffix to fit {@link ACCESS_RULE_NAME_MAX_LENGTH}, so a
 * maxed-out name still reads as a copy.
 */
function withinNameLimit(template: (base: string) => string, base: string): string {
  const rendered = template(base);
  const overrun = rendered.length - ACCESS_RULE_NAME_MAX_LENGTH;
  if (overrun <= 0) {
    return rendered;
  }
  return template(base.slice(0, Math.max(0, base.length - overrun)));
}

/**
 * Leaves `collections` empty, since a collection can be governed by only one rule. `enabled` is
 * inherited, since a copy governing no collections is inert either way.
 */
export function accessRuleToCopyRequest(
  rule: AccessRuleView,
  name: string,
): AccessRuleAddEditRequest {
  return { ...accessRuleToRequest(rule, rule.enabled), name, collections: [] };
}
