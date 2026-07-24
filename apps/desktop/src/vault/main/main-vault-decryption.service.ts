import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherSdkService } from "@bitwarden/common/vault/abstractions/cipher-sdk.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Read-only vault decryption for the main process.
 *
 * The spike (see the Stage 2b task) confirmed that a per-user SDK crypto client can be constructed
 * in the main process: every crypto-init input is disk-backed and readable via the shared
 * `stateProvider`, and the decrypted UserKey is already held authoritatively by
 * {@link MainUserKeyStateService}. This service is the read-only consumer of that client — it
 * delegates decryption to the existing, tested {@link CipherSdkService} rather than reimplementing
 * any crypto.
 *
 * IMPORTANT — not yet wired: constructing the concrete `SdkService`/`CipherSdkService` in the main
 * process (the `DefaultSdkService` dependency graph, per the CLI template in
 * `apps/cli/src/service-container/service-container.ts`) is the Stage 3 wiring step. That step must
 * be validated at runtime (cross-process cache freshness, per-user state load ordering, SDK feature
 * flags) and reviewed by the key-management team, since it introduces decrypted vault data into the
 * main-process trust boundary. Until then this service is unconstructed/inert.
 *
 * Writes (create/update) are intentionally out of scope for this read-only increment.
 */
export class MainVaultDecryptionService {
  constructor(
    private cipherSdkService: CipherSdkService,
    private logService: LogService,
  ) {}

  /**
   * Decrypt all of a user's ciphers in the main process. Ciphers that fail to decrypt are logged
   * (by count only — never their contents) and omitted from the result.
   */
  async getDecryptedCiphers(userId: UserId): Promise<CipherView[]> {
    const result = await this.cipherSdkService.getAllDecrypted(userId);
    if (result.failures.length > 0) {
      this.logService.warning(
        `[MainVaultDecryptionService] ${result.failures.length} cipher(s) failed to decrypt and were omitted`,
      );
    }
    return result.successes;
  }

  /**
   * Decrypt a user's ciphers of a single type. Convenience for the SSH agent (SSH keys) and other
   * consumers that only need one cipher type.
   */
  async getDecryptedCiphersOfType(userId: UserId, type: CipherType): Promise<CipherView[]> {
    const ciphers = await this.getDecryptedCiphers(userId);
    return ciphers.filter((cipher) => cipher.type === type);
  }
}
