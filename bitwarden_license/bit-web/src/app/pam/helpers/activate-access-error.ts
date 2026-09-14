import { serverErrorSentence } from "../abstractions/api-error";

import { UNLICENSED_SERVER_MESSAGE } from "./pam-license-error";

/**
 * The activation endpoint's error catalog, as the server words it, paired with the copy shown
 * instead. Reproduced here, not imported, since the strings cross the wire as prose with no
 * machine-readable code to switch on.
 *
 * Sourced from `ActivateAccessRequestCommand`, except the three "not permitted" sentences, which
 * the rule engine's `AccessDenialMessage` words for both this gate and the submit gate. Mixes
 * `400` and `409` responses, so the status code doesn't disambiguate them either.
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
   * The caller holds no Privileged Controls license (`PamLicenseGuard`). Reachable from surfaces
   * with no licensing block of their own — the My requests tab and shared request dialog, which
   * offer Start with no cipher in hand — and from the banner when the seat is withdrawn between
   * render and click.
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
