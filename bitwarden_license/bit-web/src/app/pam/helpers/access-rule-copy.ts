import type { AccessRuleAddEditRequest, AccessRuleView } from "../abstractions/access-rule";

import { ACCESS_RULE_NAME_MAX_LENGTH, accessRuleToRequest } from "./access-rule-request";

/** The two message keys {@link copyRuleName} renders, in the order it tries them. */
const PLAIN_SUFFIX_KEY = "pamAccessRuleDuplicateName";
const NUMBERED_SUFFIX_KEY = "pamAccessRuleDuplicateNameNumbered";

/**
 * Renders `"$NAME$ (copy)"` / `"$NAME$ (copy $NUMBER$)"`. Structurally a narrowing of
 * `I18nService.t`, declared locally so the two templates this helper needs are visible in its
 * own signature rather than behind the whole translation surface.
 */
export type CopyNameTranslator = (key: string, name: string, count?: number) => string;

/**
 * The name to give a copy of `sourceName`, avoiding every name in `takenNames`.
 *
 * The server rejects a duplicate name outright, case-insensitive per organization, and the copy
 * is created before the admin sees a form, so there's no field to correct a collision in — hence
 * the numbering: `X (copy)`, `X (copy 2)`, `X (copy 3)`. Comparison is case-insensitive to match
 * the server's own check.
 *
 * Every candidate trims the *base*, never the rendered suffix, to
 * {@link ACCESS_RULE_NAME_MAX_LENGTH} (both the column and stored-procedure parameter are
 * `NVARCHAR(256)`), so a maxed-out source still reads as a copy rather than a truncated
 * duplicate. The search caps at `takenNames.length + 1` candidates — distinctness relies on the
 * `$NUMBER$` translation token staying in place, so exhaustion falls through to the server's own
 * uniqueness check rather than looping forever.
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
 * Render `base` through `template`, shortening `base` — not the rendered suffix — by whatever
 * amount the result overruns {@link ACCESS_RULE_NAME_MAX_LENGTH}.
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
 * The create payload for a copy of `rule`: every editable field carried over, except `name`
 * (suffixed for uniqueness, see {@link copyRuleName}) and `collections` (left empty, since a
 * collection can be governed by only one rule and the admin picks them in the edit form).
 *
 * `enabled` is inherited, not forced off: an active copy is inert either way while it governs no
 * collections, so inheriting keeps the copy a faithful starting point.
 */
export function accessRuleToCopyRequest(
  rule: AccessRuleView,
  name: string,
): AccessRuleAddEditRequest {
  return { ...accessRuleToRequest(rule, rule.enabled), name, collections: [] };
}
