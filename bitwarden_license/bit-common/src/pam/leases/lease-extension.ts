import type { CipherAccessStateView } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";

export const LEASE_ENDED_MESSAGE = "The lease has ended, so it cannot be extended.";

/**
 * Checks `durationSeconds` against what the cipher's access state allows for the live lease.
 * The server stays the authority; this only turns a certain refusal into a clear message
 * before anything is sent (PAM-228).
 * @throws PamInputError when extensions are not allowed or the duration is over the maximum.
 */
export function validateExtension(state: CipherAccessStateView, durationSeconds: number): void {
  if (!state.extensionsAllowed) {
    throw new PamInputError("This lease cannot be extended.");
  }
  const max = state.maxExtensionDurationSeconds;
  if (max != null && durationSeconds > max) {
    throw new PamInputError(`The extension cannot be longer than ${max} seconds.`);
  }
}
