import { serverErrorSentence } from "../abstractions/api-error";

/**
 * The opening sentence of the server's licensing refusal (`PamLicenseGuard.UnlicensedMessage`),
 * thrown by every leasing path that ACQUIRES access — submit, activate, extend.
 *
 * Only the first sentence, so the second half ("Ask your admin…") can be reworded server-side
 * without silently degrading three client surfaces to generic copy. It still crosses the wire as
 * prose: the refusal is a `BadRequestException` with no machine-readable code, which is why the
 * sentence has to be recognised rather than switched on. **When the server grows an error code,
 * this module is the single place to retire** — the same bargain
 * {@link REQUEST_ACCESS_SERVER_ERRORS} documents for the submit catalog.
 *
 * One definition shared by all three catalogs, so the three paths cannot drift apart.
 */
export const UNLICENSED_SERVER_MESSAGE =
  "A Privileged Controls license is required to access this item.";

/** Whether a thrown SDK error is the licensing refusal. */
export function isUnlicensedError(e: unknown): boolean {
  return serverErrorSentence(e).includes(UNLICENSED_SERVER_MESSAGE);
}
