/**
 * The activation endpoint's error catalog, as the server words it, paired with the copy we show
 * instead. Reproduced here rather than imported because the strings cross the wire as prose: the
 * SDK surfaces the server's rejection as an `AccessRequestError` with `variant: "Api"` and the
 * whole serialized response body on `.message` — envelope, exception message and server-side stack
 * trace included — with no machine-readable code to switch on. When the server grows a code, this
 * catalog is the single place to retire.
 *
 * Sourced from `ActivateAccessRequestCommand`, except the three "not permitted" sentences, which
 * the rule engine's `AccessDenialMessage` words for both this gate and the submit gate. The
 * rejections are a mix of `400` (window, condition denial) and `409` (state, lease contention), so
 * the status code does not disambiguate them either.
 */
export const ACTIVATE_ACCESS_SERVER_ERRORS = Object.freeze({
  WindowNotStarted: {
    serverMessage: "The approved access window has not started yet.",
    messageKey: "pamStartLeaseErrorWindowNotStarted",
  },
  WindowEnded: {
    serverMessage: "The approved access window has already ended.",
    messageKey: "pamStartLeaseErrorWindowEnded",
  },
  NotApproved: {
    serverMessage: "This request has not been approved yet.",
    messageKey: "pamStartLeaseErrorNotApproved",
  },
  NoLongerActivatable: {
    serverMessage: "This request can no longer be activated.",
    messageKey: "pamStartLeaseErrorNoLongerActivatable",
  },
  AlreadyUsed: {
    serverMessage: "This request's access has already been used and is no longer active.",
    messageKey: "pamStartLeaseErrorAlreadyUsed",
  },
  SingleActiveLease: {
    serverMessage: "Another active lease exists for this item. Try again once it ends.",
    messageKey: "pamStartLeaseErrorSingleActiveLease",
  },
  NetworkNotPermitted: {
    serverMessage: "Access to this item is not permitted from your current network.",
    messageKey: "pamStartLeaseErrorNetworkNotPermitted",
  },
  TimeNotPermitted: {
    serverMessage: "Access to this item is not permitted at this time.",
    messageKey: "pamStartLeaseErrorTimeNotPermitted",
  },
  NotPermitted: {
    serverMessage: "Access to this item is not permitted right now.",
    messageKey: "pamStartLeaseErrorNotPermitted",
  },
} as const satisfies Record<string, { serverMessage: string; messageKey: string }>);

/** The server's sentence, decoded out of the JSON envelope the SDK concatenated onto its transport string, or `null` when the message isn't that shape. */
function serverSentence(message: string): string | null {
  const bodyStart = message.indexOf("{");
  const bodyEnd = message.lastIndexOf("}");
  if (bodyStart === -1 || bodyEnd <= bodyStart) {
    return null;
  }
  try {
    const body = JSON.parse(message.slice(bodyStart, bodyEnd + 1)) as { message?: unknown };
    return typeof body?.message === "string" ? body.message : null;
  } catch {
    return null;
  }
}

/** The i18n key to toast for a rejected activation, generic copy included. */
export function activateAccessErrorMessageKey(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  const candidate = serverSentence(message) ?? message;
  const mapped = Object.values(ACTIVATE_ACCESS_SERVER_ERRORS).find((entry) =>
    candidate.includes(entry.serverMessage),
  );
  return mapped?.messageKey ?? "pamStartLeaseError";
}
