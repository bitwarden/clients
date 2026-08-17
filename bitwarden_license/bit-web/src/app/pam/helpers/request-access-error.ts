/**
 * The PAM lease-request endpoint's error catalog, as the server words it. Two jobs:
 *
 * - detect the three RECONCILIATION cases — the requester asked for something they already have —
 *   which are not really failures and must not surface as errors, and
 * - recognise the field-level validation failures worth echoing inline on the form.
 *
 * Reproduced here rather than imported because the strings cross the wire as prose: the SDK
 * surfaces a server 400 as a `LeasingError` with `variant: "Api"` and the server's message on
 * `.message`, with no machine-readable code to switch on. When the server grows a code, this
 * catalog is the single place to retire.
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
  StartEndRequired: "A start and end date are required.",
  PositiveDurationRequired: "A positive duration is required.",
  DurationExceedsMax: "The requested duration exceeds the maximum of 86400 seconds.",
  WindowExceedsMax: "The requested window exceeds the maximum of 86400 seconds.",
  NotLeasingGated: "This item does not require a lease.",
} as const);

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
   * when `field` is set, mark that control invalid too.
   */
  | { readonly kind: "inline"; readonly serverMessage: string; readonly field?: "reason" }
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

const INLINE_SERVER_MESSAGES: ReadonlyArray<string> = [
  REQUEST_ACCESS_SERVER_ERRORS.PositiveDurationRequired,
  REQUEST_ACCESS_SERVER_ERRORS.DurationExceedsMax,
  REQUEST_ACCESS_SERVER_ERRORS.AutomaticGotWindow,
  REQUEST_ACCESS_SERVER_ERRORS.HumanGotDuration,
  REQUEST_ACCESS_SERVER_ERRORS.StartEndRequired,
  REQUEST_ACCESS_SERVER_ERRORS.StartBeforeEnd,
  REQUEST_ACCESS_SERVER_ERRORS.WindowExceedsMax,
  REQUEST_ACCESS_SERVER_ERRORS.NotLeasingGated,
];

/**
 * Classify a failed submit from the message the SDK surfaced.
 *
 * Matched with `includes` rather than equality: the wasm boundary hands the server's 400 body up
 * as `LeasingError.message`, which may carry a wrapper prefix. The catalog entries are long,
 * distinct sentences, so a substring match is unambiguous while tolerating that framing.
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

  const inline = INLINE_SERVER_MESSAGES.find((entry) => message.includes(entry));
  return inline != null ? { kind: "inline", serverMessage: inline } : { kind: "generic" };
}
