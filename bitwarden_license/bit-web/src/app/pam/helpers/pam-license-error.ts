import { serverErrorSentence } from "../abstractions/api-error";

/**
 * The first sentence of `PamLicenseGuard.UnlicensedMessage`, thrown by submit, activate and extend.
 * Only the first, so the admin-contact half can be reworded server-side without breaking the match.
 */
export const UNLICENSED_SERVER_MESSAGE =
  "A Privileged Controls license is required to access this item.";

export function isUnlicensedError(e: unknown): boolean {
  return serverErrorSentence(e).includes(UNLICENSED_SERVER_MESSAGE);
}
