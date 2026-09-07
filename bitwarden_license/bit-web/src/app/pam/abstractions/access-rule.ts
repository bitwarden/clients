import type { AccessCondition, AccessRuleError } from "@bitwarden/sdk-internal";

import { apiErrorBodyMessage } from "./api-error";

// `export type` is REQUIRED (not `export`) — these are type-only re-exports of the
// wasm SDK's shapes. Because they carry no runtime value, this line is erased by the
// compiler, so jest never resolves the wasm package while running this directory's unit tests.
export type {
  AccessCondition,
  AccessRuleAddEditRequest,
  AccessRuleError,
  AccessRuleId,
  AccessRuleView,
} from "@bitwarden/sdk-internal";

/**
 * The subset of {@link AccessCondition} this client version knows how to render.
 * The SDK passes unrecognised condition kinds through unchanged (a server-side rule
 * can carry a condition newer than this client), so UI code that matches on `kind`
 * should narrow to this type first via {@link isKnownAccessCondition} and skip
 * anything else rather than rendering nothing or crashing.
 */
export type KnownAccessCondition = Extract<
  AccessCondition,
  { kind: "human_approval" } | { kind: "ip_allowlist" }
>;

const KNOWN_ACCESS_CONDITION_KINDS: ReadonlyArray<KnownAccessCondition["kind"]> = [
  "human_approval",
  "ip_allowlist",
];

/**
 * Type guard for a condition kind this client understands. See
 * {@link KnownAccessCondition}.
 */
export function isKnownAccessCondition(
  condition: AccessCondition,
): condition is KnownAccessCondition {
  return (KNOWN_ACCESS_CONDITION_KINDS as readonly string[]).includes(condition.kind);
}

/** Type guard for the `human_approval` condition variant. */
export function isHumanApproval(
  condition: AccessCondition,
): condition is Extract<AccessCondition, { kind: "human_approval" }> {
  return condition.kind === "human_approval";
}

/** Type guard for the `ip_allowlist` condition variant. */
export function isIpAllowlist(
  condition: AccessCondition,
): condition is Extract<AccessCondition, { kind: "ip_allowlist" }> {
  return condition.kind === "ip_allowlist";
}

/**
 * The `variant` values the SDK's access-rule operations can throw, plus `NotFound`.
 *
 * `NotFound` is bridged on rather than read off the SDK type directly: the Rust side has it, but
 * no published `sdk-internal` declares it yet. Collapse once the bump lands.
 */
export type AccessRuleErrorVariant = AccessRuleError["variant"] | "NotFound";

/**
 * Structural guard for the SDK's `AccessRuleError`.
 *
 * Deliberately not the SDK's own `isAccessRuleError` — that's a runtime wasm import, and this
 * directory stays type-only. The interface itself is the SDK's, so only this detection is local.
 */
function isAccessRuleError(e: unknown): e is AccessRuleError {
  return (
    e instanceof Error &&
    (e as Partial<AccessRuleError>).name === "AccessRuleError" &&
    typeof (e as Partial<AccessRuleError>).variant === "string"
  );
}

/**
 * The toastable message carried by the SDK's `AccessRuleError`, or `undefined` when `e` isn't
 * that shape.
 *
 * The `Api` variant needs unwrapping through {@link apiErrorBodyMessage} to reach the server's
 * sentence; an unparsable body also returns `undefined`, so callers fall back to generic copy.
 */
export function accessRuleErrorMessage(e: unknown): string | undefined {
  if (!isAccessRuleError(e)) {
    return undefined;
  }
  return e.variant === "Api" ? apiErrorBodyMessage(e.message) : e.message;
}

/**
 * True when `e` is the SDK reporting a rule that no longer exists.
 *
 * Reads the variant through {@link AccessRuleErrorVariant}, since `NotFound` isn't on the
 * published SDK type yet.
 */
export function isAccessRuleNotFound(e: unknown): boolean {
  if (!isAccessRuleError(e)) {
    return false;
  }
  // Widened at the comparison, not the `const`, since TypeScript would narrow that to its
  // initializer's type.
  return (e.variant as AccessRuleErrorVariant) === "NotFound";
}
