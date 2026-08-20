import type { AccessRequestError } from "../abstractions/access-lease";

/**
 * The `variant` values a rejected access request can carry.
 *
 * The named variants are bridged on rather than read straight off `AccessRequestError["variant"]`
 * because the Rust side has them — `AccessRequestsClient` maps the server's error codes onto them —
 * but no published `sdk-internal` declares them yet. Same shape of bridge as
 * `AccessRuleErrorVariant` in `abstractions/access-rule.ts`; collapse it to `AccessRequestError["variant"]` once the bump
 * lands, and nothing else here changes.
 */
export type RequestAccessErrorVariant =
  | AccessRequestError["variant"]
  | "AlreadyActive"
  | "AlreadyPending"
  | "AlreadyApproved"
  | "CipherNotGated"
  | "DurationExpected"
  | "WindowExpected"
  | "DurationMustBePositive"
  | "DurationExceedsMax"
  | "WindowRequired"
  | "WindowEndBeforeStart"
  | "WindowExceedsMax"
  | "ReasonRequired"
  | "DeniedByNetwork"
  | "DeniedBySchedule"
  | "Denied";

/** How the cipher-view banner should respond to a failed access-request submit. */
export type RequestAccessErrorOutcome =
  /**
   * Reality already matches the requester's intent (they hold a lease, or an approved or pending
   * request). Collapse the fold-out, show `toastKey` as information rather than an error, and let
   * the access-state stream re-drive the banner into the state that already exists.
   */
  | { readonly kind: "reconcile"; readonly toastKey: string }
  /**
   * A failure the requester can act on: show `messageKey` under the form and, when `field` is set,
   * mark that control invalid too.
   */
  | { readonly kind: "inline"; readonly messageKey: string; readonly field?: "reason" }
  /** Unrecognised — fall back to the generic "could not request access" copy. */
  | { readonly kind: "generic" };

/**
 * The three variants that are not failures at all: the requester asked for something they already
 * have, so the UI reconciles rather than reporting an error.
 */
const RECONCILIATION_TOAST_KEYS: Partial<Record<RequestAccessErrorVariant, string>> = {
  AlreadyActive: "requestAccessModalAlreadyActive",
  AlreadyApproved: "requestAccessModalAlreadyApproved",
  AlreadyPending: "requestAccessModalAlreadyPending",
};

/**
 * The failures worth naming under the form, with our copy rather than the server's.
 *
 * Most of these mean the client and the server disagree about the item's approval mode, which a
 * fresh pre-check resolves; they are shown so the requester learns why the submit did not take
 * rather than watching it fail silently.
 */
const INLINE_MESSAGE_KEYS: Partial<
  Record<RequestAccessErrorVariant, { messageKey: string; field?: "reason" }>
> = {
  ReasonRequired: { messageKey: "pamRequestAccessErrorReasonRequired", field: "reason" },
  DurationMustBePositive: { messageKey: "pamRequestAccessErrorDurationRequired" },
  DurationExceedsMax: { messageKey: "pamRequestAccessErrorDurationExceedsMax" },
  DurationExpected: { messageKey: "pamRequestAccessErrorDurationExpected" },
  WindowExpected: { messageKey: "pamRequestAccessErrorWindowExpected" },
  WindowRequired: { messageKey: "pamRequestAccessErrorWindowRequired" },
  WindowEndBeforeStart: { messageKey: "pamRequestAccessErrorWindowEndBeforeStart" },
  WindowExceedsMax: { messageKey: "pamRequestAccessErrorWindowExceedsMax" },
  CipherNotGated: { messageKey: "pamRequestAccessErrorNotGated" },
  DeniedByNetwork: { messageKey: "pamRequestAccessErrorDeniedByNetwork" },
  DeniedBySchedule: { messageKey: "pamRequestAccessErrorDeniedBySchedule" },
  Denied: { messageKey: "pamRequestAccessErrorDenied" },
};

/**
 * Classify a failed submit from the variant the SDK surfaced.
 *
 * The variant is the server's error code, mapped to a typed SDK error — the contract is the code,
 * which is never localized and never reworded. This used to match the server's English sentences
 * with `String.includes()`, which meant a server-side reword silently turned a reconciliation into
 * a red error toast.
 *
 * Anything unrecognised is `generic`: an unknown code is by contract safe to treat as a plain
 * failure, so a server that grows one needs no client release.
 */
export function classifyRequestAccessError(
  variant: string | null | undefined,
): RequestAccessErrorOutcome {
  if (!variant) {
    return { kind: "generic" };
  }

  const toastKey = RECONCILIATION_TOAST_KEYS[variant as RequestAccessErrorVariant];
  if (toastKey != null) {
    return { kind: "reconcile", toastKey };
  }

  const inline = INLINE_MESSAGE_KEYS[variant as RequestAccessErrorVariant];
  return inline != null
    ? { kind: "inline", messageKey: inline.messageKey, field: inline.field }
    : { kind: "generic" };
}
