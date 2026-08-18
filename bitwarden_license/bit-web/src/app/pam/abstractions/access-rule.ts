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
 *
 * The `Api` variant needs unwrapping first: the SDK stringifies the whole failed
 * response as `error in response: status code 400 Bad Request: {…ErrorResponseModel
 * JSON…}`, so the human-readable server message (`"A rule with that name already
 * exists."`, …) is buried inside a JSON body. Surface that inner message; when there
 * is no parsable body (network failures, serde errors) return `undefined` so callers
 * use their generic fallback rather than toasting the raw wrapper.
 */
export function accessRuleErrorMessage(e: unknown): string | undefined {
  if (!isAccessRuleError(e)) {
    return undefined;
  }
  return e.variant === "Api" ? apiErrorBodyMessage(e.message) : e.message;
}

/** Extract the server's `message` field from an `Api`-variant error string, if present. */
function apiErrorBodyMessage(message: string): string | undefined {
  const bodyStart = message.indexOf("{");
  if (bodyStart === -1) {
    return undefined;
  }
  try {
    const body: unknown = JSON.parse(message.slice(bodyStart));
    const serverMessage = (body as { message?: unknown }).message;
    return typeof serverMessage === "string" && serverMessage.length > 0
      ? serverMessage
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True when `e` is the server's rejection of a rule whose collections are already
 * governed by a different access rule (a collection can only carry one rule).
 *
 * Matched on the server's message text — the `ErrorResponseModel` contract carries no
 * machine-readable code, so this fragment is the only discriminant on the wire. Kept
 * in sync with `AccessRuleWriteValidator` on the server; on drift this degrades to the
 * extracted server message rather than the friendlier client copy.
 */
export function isAccessRuleCollectionConflict(e: unknown): boolean {
  return (
    accessRuleErrorMessage(e)?.toLowerCase().includes("already governed by another access rule") ??
    false
  );
}

/** True when `e` is the SDK's `AccessRuleError` with the `NotFound` variant. */
export function isAccessRuleNotFound(e: unknown): boolean {
  return isAccessRuleError(e) && e.variant === "NotFound";
}
