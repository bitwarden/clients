import type { AccessRuleAddEditRequest, AccessRuleView } from "../abstractions/access-rule";

/**
 * Build the create/update payload for a rule, copying every field from the loaded
 * view and overriding only `enabled`. Used by the enable/disable toggles (single and
 * bulk), which round-trip the whole rule unchanged otherwise.
 *
 * Copies `allowsExtensions` / `maxExtensionDurationSeconds` too — an earlier version
 * of this helper dropped them, which meant toggling a rule's enabled state silently
 * wiped its extension settings on save. Copy every field so that bug can't recur.
 */
export function accessRuleToRequest(
  rule: AccessRuleView,
  enabled: boolean,
): AccessRuleAddEditRequest {
  return {
    name: rule.name,
    description: rule.description,
    conditions: rule.conditions,
    collections: rule.collections,
    defaultLeaseDurationSeconds: rule.defaultLeaseDurationSeconds,
    maxLeaseDurationSeconds: rule.maxLeaseDurationSeconds,
    singleActiveLease: rule.singleActiveLease,
    enabled,
    allowsExtensions: rule.allowsExtensions,
    maxExtensionDurationSeconds: rule.maxExtensionDurationSeconds,
  };
}
