import { Observable } from "rxjs";

import { CipherId } from "@bitwarden/common/types/guid";

/**
 * Optional, platform-specific settings for SSH-agent destination host-key fingerprints.
 *
 * Not every client provides this — it is currently implemented on Desktop only, backed by
 * client-local storage. Consumers must inject it with `@Optional()` and treat `undefined` as
 * "this platform doesn't support destination filtering," not as an error.
 *
 * This is an identity-offering optimization, not an authorization or security boundary: it
 * restricts which stored SSH keys the agent *offers* for a given destination, it does not
 * authorize or block a server from being connected to.
 */
export abstract class SshAgentDestinationSettingsService {
  /**
   * The destination host-key fingerprints currently configured for the given cipher.
   * Emits an empty array when the key is unrestricted (offered for any destination).
   */
  abstract destinationFingerprints$(cipherId: CipherId): Observable<string[]>;

  /**
   * Replaces the destination host-key fingerprints configured for the given cipher.
   * Passing an empty array clears any restriction, making the key unrestricted again.
   */
  abstract setDestinationFingerprints(cipherId: CipherId, fingerprints: string[]): Promise<void>;
}
