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
 * `NotFound` is bridged on rather than read straight off `AccessRuleError["variant"]` because the
 * Rust side has it — `AccessRulesClient` maps the server's 404 on its by-id calls — but no
 * published `sdk-internal` declares it yet. Same shape of bridge as the partial-cipher aliases in
 * `libs/common/src/vault/models/domain/cipher.ts`; collapse it to `AccessRuleError["variant"]`
 * once the bump lands, and nothing else here changes.
 */
export type AccessRuleErrorVariant = AccessRuleError["variant"] | "NotFound";

/**
 * Structural guard for the SDK's `AccessRuleError`.
 *
 * Deliberately NOT the SDK's own `isAccessRuleError`: that is a runtime import from the wasm
 * package, and this directory stays type-only so jest never resolves it (see this module's
 * `CLAUDE.md`; `LeasingErrorService` is the injectable seam the leasing guards use for the same
 * reason). The interface itself is now the SDK's, so the two cannot drift on shape — only this
 * detection is local.
 */
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
 * The `Api` variant needs unwrapping first through {@link apiErrorBodyMessage}, which digs the
 * server's sentence (`"A rule with that name already exists."`, …) out of the serialized response
 * body. When there is no parsable body (network failures, serde errors) return `undefined` so
 * callers use their generic fallback rather than toasting the raw wrapper.
 */
export function accessRuleErrorMessage(e: unknown): string | undefined {
  if (!isAccessRuleError(e)) {
    return undefined;
  }
  return e.variant === "Api" ? apiErrorBodyMessage(e.message) : e.message;
}

/**
 * True when `e` is the SDK reporting a rule that does not exist — the caller followed a link to a
 * rule someone else deleted, or deleted it in another tab.
 *
 * Reads the variant through {@link AccessRuleErrorVariant} because `NotFound` is not on the
 * published SDK type yet; see that alias.
 */
export function isAccessRuleNotFound(e: unknown): boolean {
  if (!isAccessRuleError(e)) {
    return false;
  }
  // Widened at the comparison, not on a `const`: TypeScript narrows a const to its initializer's
  // type, so annotating the variable would still leave `NotFound` outside the compared union.
  return (e.variant as AccessRuleErrorVariant) === "NotFound";
}
