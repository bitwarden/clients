import { UNLICENSED_SERVER_MESSAGE } from "./pam-license-error";

/**
 * The PAM lease-request endpoint's error catalog, as the server words it: detects the
 * reconciliation cases where the requester already has what they asked for, and the field-level
 * validation failures worth echoing inline.
 *
 * Reproduced here, not imported, since the strings cross the wire as prose — the SDK surfaces a
 * server 400 with no machine-readable code to switch on.
 *
 * Every entry must be the sentence the SERVER actually throws; a refusal the SDK raises before
 * the wire belongs in {@link REQUEST_ACCESS_SDK_ERRORS} instead, and the two are not kept in step.
 * A sentence the server interpolates a value into is matched by {@link EXCEEDS_MAX_PATTERN}.
 */
export const REQUEST_ACCESS_SERVER_ERRORS = Object.freeze({
  ReasonRequired: "A reason is required for items that need human approval.",
  AlreadyActive: "You already have active access to this item.",
  AlreadyApproved: "You already have an approved request for this item.",
  AlreadyPending: "You already have a pending request for this item.",
  AutomaticGotWindow: "This item is approved automatically; provide a duration, not a window.",
  HumanGotDuration:
    "This item requires human approval; provide a start and end date, not a duration.",
  StartBeforeEnd: "The start date must be before the end date.",
  /**
   * The server's refusal of a window that has already elapsed. The SDK refuses the same window
   * before the wire, but in its OWN words — {@link REQUEST_ACCESS_SDK_ERRORS.WindowInPast} — so
   * the condition needs an entry on each side.
   */
  WindowInPast: "The end date must be in the future.",
  StartEndRequired: "A start and end date are required.",
  PositiveDurationRequired: "A positive duration is required.",
  NotLeasingGated: "This item does not require a lease.",
  /**
   * The caller holds no Privileged Controls license. The banner blocks the form before a submit
   * can be attempted, so reaching this means the license lapsed between render and submit.
   */
  Unlicensed: UNLICENSED_SERVER_MESSAGE,
} as const);

/**
 * Refusals the SDK raises locally, before the request reaches the wire.
 *
 * `AccessRequestError::Validation` is `#[error(transparent)]`, so `.message` is the inner
 * `AccessRequestWindowError`'s own `Display` — worded independently of the server's sentence for
 * the same condition. Kept apart from {@link REQUEST_ACCESS_SERVER_ERRORS}; the two are not kept
 * in step.
 */
export const REQUEST_ACCESS_SDK_ERRORS = Object.freeze({
  /** `AccessRequestWindowError::EndInPast`, the local twin of `WindowInPast`. */
  WindowInPast: "The requested window has already ended.",
} as const);

/**
 * The refusal the server interpolates its `EffectiveMax` into, so no fixed sentence can match it —
 * pinning one cap here degrades every narrower rule to generic copy.
 *
 * Captures the noun as well as the number: the duration and window paths differ only in that word,
 * and a duration refusal must not be worded as a window one.
 */
const EXCEEDS_MAX_PATTERN =
  /The requested (duration|window) exceeds the maximum of (\d+) seconds\./;

/** How the cipher-view banner should respond to a failed access-request submit. */
export type RequestAccessErrorOutcome =
  /**
   * Reality already matches the requester's intent (they hold a lease, or an approved or pending
   * request). Collapse the fold-out, show `toastKey` as information rather than an error, and let
   * the access-state stream re-drive the banner into the state that already exists.
   */
  | { readonly kind: "reconcile"; readonly toastKey: string }
  /**
   * A validation failure the requester can fix in place: echo `serverMessage` under the form and,
   * when `field` is set, mark that control invalid. Also carries a local SDK refusal verbatim,
   * since both are already prose in the requester's language.
   */
  | { readonly kind: "inline"; readonly serverMessage: string; readonly field?: "reason" }
  /**
   * The server refused the requested length. `maxSeconds` is the maximum it applied, which may be
   * narrower than the one the form was told about, and `scope` is which path it refused. Both are
   * carried so a caller holding a localized string for that path can render it; `serverMessage` is
   * the sentence to fall back on where it has none.
   */
  | {
      readonly kind: "exceedsMax";
      readonly scope: "duration" | "window";
      readonly maxSeconds: number;
      readonly serverMessage: string;
    }
  /** Unrecognised — fall back to the generic "could not request access" copy. */
  | { readonly kind: "generic" };

const RECONCILIATION_TOAST_KEYS: ReadonlyArray<{ serverMessage: string; toastKey: string }> = [
  {
    serverMessage: REQUEST_ACCESS_SERVER_ERRORS.AlreadyActive,
    toastKey: "requestAccessModalAlreadyActive",
  },
  {
    serverMessage: REQUEST_ACCESS_SERVER_ERRORS.AlreadyApproved,
    toastKey: "requestAccessModalAlreadyApproved",
  },
  {
    serverMessage: REQUEST_ACCESS_SERVER_ERRORS.AlreadyPending,
    toastKey: "requestAccessModalAlreadyPending",
  },
];

/** Every message echoed inline under the form, from either source — the requester's fix is the same either way. */
const INLINE_MESSAGES: ReadonlyArray<string> = [
  REQUEST_ACCESS_SERVER_ERRORS.PositiveDurationRequired,
  REQUEST_ACCESS_SERVER_ERRORS.AutomaticGotWindow,
  REQUEST_ACCESS_SERVER_ERRORS.HumanGotDuration,
  REQUEST_ACCESS_SERVER_ERRORS.StartEndRequired,
  REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd,
  REQUEST_ACCESS_SERVER_ERRORS.WindowInPast,
  REQUEST_ACCESS_SDK_ERRORS.WindowInPast,
  REQUEST_ACCESS_SERVER_ERRORS.NotLeasingGated,
  REQUEST_ACCESS_SERVER_ERRORS.Unlicensed,
];

/**
 * Classify a failed submit from the message the SDK surfaced.
 *
 * Matched with `includes` rather than equality: the wasm boundary hands the server's 400 body up
 * as `LeasingError.message`, which may carry a wrapper prefix. The catalog entries are long,
 * distinct sentences, so a substring match is unambiguous while tolerating that framing.
 *
 * An {@link EXCEEDS_MAX_PATTERN} hit returns `exceedsMax` rather than `inline`, since that one
 * refusal is worth re-rendering in the requester's own language.
 */
export function classifyRequestAccessError(
  message: string | null | undefined,
): RequestAccessErrorOutcome {
  if (!message) {
    return { kind: "generic" };
  }

  const reconciliation = RECONCILIATION_TOAST_KEYS.find((entry) =>
    message.includes(entry.serverMessage),
  );
  if (reconciliation != null) {
    return { kind: "reconcile", toastKey: reconciliation.toastKey };
  }

  if (message.includes(REQUEST_ACCESS_SERVER_ERRORS.ReasonRequired)) {
    return {
      kind: "inline",
      serverMessage: REQUEST_ACCESS_SERVER_ERRORS.ReasonRequired,
      field: "reason",
    };
  }

  const inline = INLINE_MESSAGES.find((entry) => message.includes(entry));
  if (inline != null) {
    return { kind: "inline", serverMessage: inline };
  }

  // Reports the captured maximum rather than the sentence; nothing here can know it in advance.
  const interpolated = EXCEEDS_MAX_PATTERN.exec(message);
  return interpolated != null
    ? {
        kind: "exceedsMax",
        scope: interpolated[1] === "duration" ? "duration" : "window",
        maxSeconds: Number(interpolated[2]),
        serverMessage: interpolated[0],
      }
    : { kind: "generic" };
}
