import type { AccessRuleAddEditRequest, AccessRuleView } from "../abstractions/access-rule";

/**
 * Build the create/update payload for a rule from its loaded view, overriding only
 * `enabled`. Used by the enable/disable toggles (single and bulk), which otherwise
 * round-trip the rule unchanged.
 *
 * Maps the request fields explicitly rather than spreading the view: the view carries
 * server-managed fields (`id`, `organizationId`, `creationDate`, `revisionDate`) that
 * aren't part of the request, and spreading would leak them into the payload. Every
 * editable field is copied — including `allowsExtensions` / `maxExtensionDurationSeconds`,
 * which an earlier version dropped, silently wiping a rule's extension settings whenever
 * its enabled state was toggled.
 */
export function accessRuleToRequest(
  rule: AccessRuleView,
  enabled: boolean,
): AccessRuleAddEditRequest {
  return {
    name: rule.name,
    description: rule.description,
    enabled,
    conditions: rule.conditions,
    singleActiveLease: rule.singleActiveLease,
    defaultLeaseDurationSeconds: rule.defaultLeaseDurationSeconds,
    maxLeaseDurationSeconds: rule.maxLeaseDurationSeconds,
    allowsExtensions: rule.allowsExtensions,
    maxExtensionDurationSeconds: rule.maxExtensionDurationSeconds,
    collections: rule.collections,
  };
}
