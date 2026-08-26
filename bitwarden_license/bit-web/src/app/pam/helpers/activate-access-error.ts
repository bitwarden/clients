/**
 * The activation endpoint's error catalog, as the server words it, paired with the copy we show
 * instead. Reproduced here rather than imported because the strings cross the wire as prose: the
 * SDK surfaces the server's rejection with `variant: "Api"` and the whole serialized response body
 * on `.message` — envelope, `exceptionMessage` and a stack trace carrying the server's absolute
 * filesystem paths — with no machine-readable code to switch on. When the server grows a code, this
 * catalog is the single place to retire.
 *
 * Sourced from `ActivateAccessRequestCommand.ActivateAsync` and `Engine/AccessDenialMessage.cs`.
 * The `NotFoundException` path is deliberately absent: it carries no sentence, and its 404 is
 * indistinguishable from "that request isn't yours" on purpose, so the generic copy is the honest
 * thing to show. The three denial sentences are vague about which condition failed for the same
 * reason — the requester cannot see the rule, and naming the CIDR or the window would let them
 * probe it.
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

/**
 * The i18n key to toast for a rejected activation, generic copy included.
 *
 * An i18n key is all that comes back — the raw error never leaves this function, which is the
 * point: its message is the server's serialized response, and putting it on screen would publish
 * the server's filesystem paths and .NET frames to the requester.
 *
 * Matched with `includes` rather than equality: the wire body wraps the server's sentence in a JSON
 * envelope and repeats it in `exceptionMessage`. The catalog entries are whole, distinct sentences,
 * none a substring of another, so a substring match is unambiguous while tolerating that framing.
 */
export function activateAccessErrorMessageKey(e: unknown): string {
  const message = e instanceof Error ? e.message : undefined;
  if (!message) {
    return "pamStartLeaseError";
  }

  const mapped = Object.values(ACTIVATE_ACCESS_SERVER_ERRORS).find((entry) =>
    message.includes(entry.serverMessage),
  );
  return mapped?.messageKey ?? "pamStartLeaseError";
}
