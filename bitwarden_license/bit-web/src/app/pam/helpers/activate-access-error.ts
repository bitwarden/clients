import { serverErrorSentence } from "../abstractions/api-error";

import { UNLICENSED_SERVER_MESSAGE } from "./pam-license-error";

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
  /**
   * The caller holds no Privileged Controls license (PM-39423, `PamLicenseGuard`). Reachable from
   * surfaces that have no licensing block of their own — the My requests tab and the shared
   * request dialog both offer Start off a request row, with no cipher in hand to check licensing
   * against — as well as from the banner when the seat is withdrawn between render and click.
   */
  Unlicensed: {
    serverMessage: UNLICENSED_SERVER_MESSAGE,
    messageKey: "pamLeaseErrorUnlicensed",
  },
} as const satisfies Record<string, { serverMessage: string; messageKey: string }>);

/** The i18n key to toast for a rejected activation, generic copy included. */
export function activateAccessErrorMessageKey(e: unknown): string {
  const candidate = serverErrorSentence(e);
  const mapped = Object.values(ACTIVATE_ACCESS_SERVER_ERRORS).find((entry) =>
    candidate.includes(entry.serverMessage),
  );
  return mapped?.messageKey ?? "pamStartLeaseError";
}
