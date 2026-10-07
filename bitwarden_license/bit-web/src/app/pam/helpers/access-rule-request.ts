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

/** The longest name the SDK and the server accept, matching `dbo.AccessRule.Name`. */
export const ACCESS_RULE_NAME_MAX_LENGTH = 256;

/** The longest description the edit form accepts. */
export const ACCESS_RULE_DESCRIPTION_MAX_LENGTH = 512;

/**
 * The edit form's `getRawValue()`, declared structurally so this helper stays testable without a
 * TestBed. `collections` carries only the `id` the request needs.
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
 * Omits `collections`, mapped onto the multi-select's options once they load, and
 * `ipAllowlistCidrs`, a `FormArray` that `patchValue` can't resize.
 */
export type AccessRuleFormPatch = Omit<AccessRuleFormValue, "collections" | "ipAllowlistCidrs">;

/**
 * Snaps durations to their pickers' options, so a value persisted outside a set still renders
 * instead of blanking the select.
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
 * `unknownConditions`, kinds this client doesn't model, are appended unchanged so editing an
 * unrelated field never drops them.
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
 * Maps fields explicitly rather than spreading the view, which carries server-managed fields that
 * aren't part of the request. A field missed here is wiped whenever the rule is toggled.
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
