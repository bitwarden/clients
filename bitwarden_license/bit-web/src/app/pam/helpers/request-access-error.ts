import { UNLICENSED_SERVER_MESSAGE } from "./pam-license-error";

/**
 * The submit endpoint's refusals as the server words them, since no machine-readable code crosses
 * the wire. A refusal the SDK raises before the wire belongs in {@link REQUEST_ACCESS_SDK_ERRORS}.
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
  /** The SDK refuses this before the wire in its own words, so each side needs an entry. */
  WindowInPast: "The end date must be in the future.",
  StartEndRequired: "A start and end date are required.",
  PositiveDurationRequired: "A positive duration is required.",
  NotLeasingGated: "This item does not require a lease.",
  /** The banner blocks the form first, so this means the license lapsed after render. */
  Unlicensed: UNLICENSED_SERVER_MESSAGE,
} as const);

/**
 * Refusals the SDK raises before the wire. `AccessRequestError::Validation` is transparent, so
 * `.message` is the inner `AccessRequestWindowError`, worded independently of the server.
 */
export const REQUEST_ACCESS_SDK_ERRORS = Object.freeze({
  /** `AccessRequestWindowError::EndInPast`, the local twin of `WindowInPast`. */
  WindowInPast: "The requested window has already ended.",
} as const);

/**
 * The refusal the server interpolates its `EffectiveMax` into. Captures the noun too, since a
 * duration refusal must not be worded as a window one.
 */
const EXCEEDS_MAX_PATTERN =
  /The requested (duration|window) exceeds the maximum of (\d+) seconds\./;

/** How the cipher-view banner should respond to a failed access-request submit. */
export type RequestAccessErrorOutcome =
  /**
   * The requester already has what they asked for, so `toastKey` is information rather than an
   * error.
   */
  | { readonly kind: "reconcile"; readonly toastKey: string }
  /**
   * A failure the requester can fix in place. `serverMessage` may also be a local SDK refusal,
   * echoed verbatim.
   */
  | { readonly kind: "inline"; readonly serverMessage: string; readonly field?: "reason" }
  /**
   * `maxSeconds` is the maximum the server applied, which may be narrower than the form was told.
   * `serverMessage` is the fallback for a path with no localized string.
   */
  | {
      readonly kind: "exceedsMax";
      readonly scope: "duration" | "window";
      readonly maxSeconds: number;
      readonly serverMessage: string;
    }
  /** Unrecognised, so the generic copy shows. */
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

/** Echoed inline from either source, since the requester's fix is the same. */
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

/** Matched with `includes`, since an undecoded message keeps the SDK's transport prefix. */
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
