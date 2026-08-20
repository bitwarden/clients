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
 * The server rejects a duplicate name outright (`AccessRuleWriteValidator.ValidateNameIsUniqueAsync`,
 * case-insensitive per organization), and the copy is created before the admin ever sees a form —
 * so unlike a rejected save, there is no field to correct the collision in. Copying the same rule
 * twice has to just work, hence the numbering: `X (copy)`, `X (copy 2)`, `X (copy 3)`.
 *
 * Comparison is case-insensitive to match the server's `OrdinalIgnoreCase`; a client-side match the
 * server would not make (or vice versa) would put us back to an unfixable rejection.
 *
 * Two hard limits shape the result:
 *
 * - Every candidate is trimmed to {@link ACCESS_RULE_NAME_MAX_LENGTH}, because the column and the
 *   stored procedure's parameter are both `NVARCHAR(256)` and SQL Server truncates silently. The
 *   *base* is trimmed, never the rendered suffix, so a 256-character source still yields a name
 *   visibly marked as a copy rather than one truncated back into a duplicate of its source.
 * - The search stops after `takenNames.length + 1` candidates. With distinct candidates one of
 *   them must be free, so the ceiling never binds in practice — it is there because distinctness
 *   rests on a *translation* keeping `$NUMBER$`. A locale that dropped it would render every
 *   numbered candidate identically and spin this loop forever. On exhaustion the last candidate
 *   is returned and the server's uniqueness check arbitrates, which surfaces as a mapped,
 *   actionable error rather than a frozen tab.
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
 * Render `base` through `template`, shortening `base` — not the rendered suffix — by however much
 * the result overruns {@link ACCESS_RULE_NAME_MAX_LENGTH}.
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
 * The create payload for a copy of `rule`: every editable field carried over from the source,
 * except two.
 *
 * - `name` — the server enforces uniqueness, so the copy is suffixed (see {@link copyRuleName}).
 * - `collections` — deliberately empty. A collection can be governed by exactly one rule
 *   (`AccessRuleWriteValidator.ValidateCollectionsAsync`), so carrying the source's collections
 *   over would be rejected on write; the admin picks them in the edit form the copy opens into.
 *
 * `enabled` is inherited rather than forced off. An active copy is inert either way while it
 * governs no collections, so there is nothing to protect against by disabling it, and inheriting
 * keeps the copy a faithful starting point.
 */
export function accessRuleToCopyRequest(
  rule: AccessRuleView,
  name: string,
): AccessRuleAddEditRequest {
  return { ...accessRuleToRequest(rule, rule.enabled), name, collections: [] };
}
