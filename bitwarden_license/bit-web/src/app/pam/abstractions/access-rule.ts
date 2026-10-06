import type { AccessCondition } from "@bitwarden/sdk-internal";

// `export type` is REQUIRED (not `export`) — these are type-only re-exports of the
// wasm SDK's shapes. Because they carry no runtime value, this line is erased by the
// compiler, so jest never resolves the wasm package while running this directory's unit tests.
export type {
  AccessCondition,
  AccessRuleAddEditRequest,
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

/** The `variant` values the SDK's access-rule operations can throw. */
export type AccessRuleErrorVariant =
  | "BadRequest"
  | "NotFound"
  | "Validation"
  | "InvalidConditions"
  | "MissingField"
  | "Chrono"
  | "Api";

/**
 * The flat error shape thrown by the SDK's access-rule CRUD calls
 * (`commercial().pam().access_rules()`). Hand-written rather than imported: the SDK
 * does not yet publish an `AccessRuleError` type or an `isAccessRuleError` guard for
 * it (unlike e.g. `CryptoError`/`isCryptoError`, already generated for other domains
 * in `@bitwarden/sdk-internal`) — this mirrors that same wasm-bindgen convention (a
 * `name`-tagged `Error` subclass with a `variant` discriminant) so this file can be
 * swapped to the SDK's own export once it lands, with no change to callers of
 * {@link accessRuleErrorMessage} / {@link isAccessRuleNotFound}.
 */
export interface AccessRuleError extends Error {
  name: "AccessRuleError";
  variant: AccessRuleErrorVariant;
}

function isAccessRuleError(e: unknown): e is AccessRuleError {
  return (
    e instanceof Error &&
    (e as Partial<AccessRuleError>).name === "AccessRuleError" &&
    typeof (e as Partial<AccessRuleError>).variant === "string"
  );
}

/**
 * The toastable message carried by the SDK's `AccessRuleError`, or `undefined` when
 * `e` isn't that shape — callers fall back to a generic error message in that case.
 */
export function accessRuleErrorMessage(e: unknown): string | undefined {
  return isAccessRuleError(e) ? e.message : undefined;
}

/** True when `e` is the SDK's `AccessRuleError` with the `NotFound` variant. */
export function isAccessRuleNotFound(e: unknown): boolean {
  return isAccessRuleError(e) && e.variant === "NotFound";
}
