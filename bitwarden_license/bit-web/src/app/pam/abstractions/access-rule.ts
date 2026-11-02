import type { AccessCondition, AccessRuleError } from "@bitwarden/sdk-internal";

import { apiErrorBodyMessage } from "./api-error";

// `export type`, so the compiler erases this line and jest never resolves the wasm package.
export type {
  AccessCondition,
  AccessRuleAddEditRequest,
  AccessRuleError,
  AccessRuleId,
  AccessRuleView,
} from "@bitwarden/sdk-internal";

/**
 * The conditions this client can render. The SDK passes newer kinds through unchanged, so narrow
 * with {@link isKnownAccessCondition} and skip the rest.
 */
export type KnownAccessCondition = Extract<
  AccessCondition,
  { kind: "human_approval" } | { kind: "ip_allowlist" }
>;

const KNOWN_ACCESS_CONDITION_KINDS: ReadonlyArray<KnownAccessCondition["kind"]> = [
  "human_approval",
  "ip_allowlist",
];

export function isKnownAccessCondition(
  condition: AccessCondition,
): condition is KnownAccessCondition {
  return (KNOWN_ACCESS_CONDITION_KINDS as readonly string[]).includes(condition.kind);
}

export function isHumanApproval(
  condition: AccessCondition,
): condition is Extract<AccessCondition, { kind: "human_approval" }> {
  return condition.kind === "human_approval";
}

export function isIpAllowlist(
  condition: AccessCondition,
): condition is Extract<AccessCondition, { kind: "ip_allowlist" }> {
  return condition.kind === "ip_allowlist";
}

export type AccessRuleErrorVariant = AccessRuleError["variant"];

/**
 * Not the SDK's own `isAccessRuleError`, which is a runtime wasm import; this directory stays
 * type-only.
 */
function isAccessRuleError(e: unknown): e is AccessRuleError {
  return (
    e instanceof Error &&
    (e as Partial<AccessRuleError>).name === "AccessRuleError" &&
    typeof (e as Partial<AccessRuleError>).variant === "string"
  );
}

/**
 * The toastable message of an `AccessRuleError`, or `undefined` for any other error or an
 * unparsable `Api` body.
 */
export function accessRuleErrorMessage(e: unknown): string | undefined {
  if (!isAccessRuleError(e)) {
    return undefined;
  }
  return e.variant === "Api" ? apiErrorBodyMessage(e.message) : e.message;
}

/** True when `e` is the SDK reporting a rule that no longer exists. */
export function isAccessRuleNotFound(e: unknown): boolean {
  if (!isAccessRuleError(e)) {
    return false;
  }
  return e.variant === "NotFound";
}
