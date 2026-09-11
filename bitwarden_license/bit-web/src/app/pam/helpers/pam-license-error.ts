import { serverErrorSentence } from "../abstractions/api-error";

/**
 * The opening sentence of the server's licensing refusal (`PamLicenseGuard.UnlicensedMessage`),
 * thrown by every leasing path that ACQUIRES access — submit, activate, extend.
 *
 * Only the first sentence, so the admin-contact half can be reworded server-side without
 * degrading three surfaces to generic copy. Crosses the wire as prose, with no machine-readable
 * code, so it's recognised rather than switched on.
 *
 * One definition shared by all three catalogs, so the paths can't drift apart.
 */
export const UNLICENSED_SERVER_MESSAGE =
  "A Privileged Controls license is required to access this item.";

/** Whether a thrown SDK error is the licensing refusal. */
export function isUnlicensedError(e: unknown): boolean {
  return serverErrorSentence(e).includes(UNLICENSED_SERVER_MESSAGE);
}
