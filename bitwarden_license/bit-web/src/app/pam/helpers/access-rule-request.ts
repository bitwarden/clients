import type { CollectionId } from "@bitwarden/sdk-internal";

import {
  type AccessCondition,
  type AccessRuleAddEditRequest,
  type AccessRuleView,
  isHumanApproval,
  isIpAllowlist,
} from "../abstractions/access-rule";

import {
  DEFAULT_MAX_EXTENSION_DURATION_SECONDS,
  EXTENSION_DURATION_OPTIONS,
  snapToNearestAccessRuleDuration,
  snapToNearestDuration,
} from "./lease-window.utils";

/** The "no maximum" option in the max-duration picker; encodes to an absent cap. */
export const NO_DURATION_CAP = 0;

/**
 * The flattened value of the access-rule edit form (`formGroup.getRawValue()`), as
 * consumed by {@link formValueToRequest}. Declared structurally here — rather than
 * derived from the component's `FormGroup` — so this helper stays framework-agnostic
 * and unit-testable without a TestBed. `collections` is narrowed to just the `id`
 * the request needs, decoupling it from the multi-select's richer `SelectItemView`.
 */
export interface AccessRuleFormValue {
  name: string;
  description: string;
  collections: { id: string }[];
  defaultLeaseDurationSeconds: number;
  maxLeaseDurationSeconds: number;
  singleActiveLease: boolean;
  enabled: boolean;
  allowsExtensions: boolean;
  maxExtensionDurationSeconds: number;
  humanApprovalEnabled: boolean;
  ipAllowlistEnabled: boolean;
  ipAllowlistCidrs: string[];
}

/**
 * The subset of {@link AccessRuleFormValue} that {@link accessRuleToFormValue} produces
 * and the edit page feeds to `patchValue`. Excludes `collections` (populated separately
 * once the collection list loads, to map stored ids onto the multi-select's options) and
 * `ipAllowlistCidrs` (a FormArray seeded row-by-row, since `patchValue` can't resize one).
 */
export type AccessRuleFormPatch = Omit<AccessRuleFormValue, "collections" | "ipAllowlistCidrs">;

/**
 * Map a loaded rule onto the edit form's values — the inbound counterpart to
 * {@link formValueToRequest}, for the fields a single `patchValue` can set.
 *
 * Durations are snapped to their pickers' option sets so a value persisted outside a set
 * still renders against an option rather than blanking the select. An absent max lease
 * encodes to {@link NO_DURATION_CAP} ("no cap") and an absent max extension to
 * {@link DEFAULT_MAX_EXTENSION_DURATION_SECONDS}; the two known conditions drive their
 * checkboxes. Collections and the CIDR rows are applied separately by the caller — see
 * {@link AccessRuleFormPatch}.
 */
export function accessRuleToFormValue(rule: AccessRuleView): AccessRuleFormPatch {
  return {
    name: rule.name,
    description: rule.description ?? "",
    defaultLeaseDurationSeconds: snapToNearestAccessRuleDuration(rule.defaultLeaseDurationSeconds),
    maxLeaseDurationSeconds:
      rule.maxLeaseDurationSeconds == null
        ? NO_DURATION_CAP
        : snapToNearestAccessRuleDuration(rule.maxLeaseDurationSeconds),
    singleActiveLease: rule.singleActiveLease,
    enabled: rule.enabled,
    allowsExtensions: rule.allowsExtensions,
    maxExtensionDurationSeconds:
      rule.maxExtensionDurationSeconds == null
        ? DEFAULT_MAX_EXTENSION_DURATION_SECONDS
        : snapToNearestDuration(rule.maxExtensionDurationSeconds, EXTENSION_DURATION_OPTIONS),
    humanApprovalEnabled: rule.conditions?.some(isHumanApproval) ?? false,
    ipAllowlistEnabled: rule.conditions?.some(isIpAllowlist) ?? false,
  };
}

/**
 * Build the create/update payload from the edit form's value.
 *
 * Encodes the form's UI conventions into the request shape: the two checkbox-driven
 * known conditions (`human_approval` / `ip_allowlist`) are rebuilt from their toggles,
 * then `unknownConditions` — kinds this client doesn't model (e.g. the server's
 * `time_of_day`) that were stashed off the loaded rule — are appended unchanged so
 * editing an unrelated field never silently drops them. An empty description and a
 * {@link NO_DURATION_CAP} max both encode to `undefined`, and the max extension length
 * is only carried when extensions are enabled.
 *
 * No runtime UUID validation on `collections` (unlike the SDK-boundary code in
 * `AccessRulesSdkService`) — this is just a type-level bridge from the multi-select's
 * plain string ids to the SDK's branded `CollectionId`.
 */
export function formValueToRequest(
  value: AccessRuleFormValue,
  unknownConditions: AccessCondition[],
): AccessRuleAddEditRequest {
  const conditions: AccessCondition[] = [];

  if (value.humanApprovalEnabled) {
    conditions.push({ kind: "human_approval" });
  }

  if (value.ipAllowlistEnabled) {
    conditions.push({
      kind: "ip_allowlist",
      cidrs: value.ipAllowlistCidrs.map((c) => c.trim()).filter((c) => c !== ""),
    });
  }

  conditions.push(...unknownConditions);

  return {
    name: value.name,
    description: value.description.length === 0 ? undefined : value.description,
    conditions,
    collections: value.collections.map((i) => i.id as unknown as CollectionId),
    defaultLeaseDurationSeconds: value.defaultLeaseDurationSeconds,
    maxLeaseDurationSeconds:
      value.maxLeaseDurationSeconds === NO_DURATION_CAP ? undefined : value.maxLeaseDurationSeconds,
    singleActiveLease: value.singleActiveLease,
    enabled: value.enabled,
    allowsExtensions: value.allowsExtensions,
    maxExtensionDurationSeconds: value.allowsExtensions
      ? value.maxExtensionDurationSeconds
      : undefined,
  };
}

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
