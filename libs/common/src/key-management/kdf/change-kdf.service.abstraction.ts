import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

export abstract class ChangeKdfService {
  /**
   * Updates the user's KDF parameters
   * @param masterPassword The user's current master password
   * @param kdf The new KDF configuration to apply
   * @param userId The ID of the user whose KDF parameters are being updated
   * @throws If any of the parameters is null
   * @throws If the user is locked or logged out
   * @throws If the kdf change request fails
   */
  abstract updateUserKdfParams(
    masterPassword: string,
    kdf: KdfConfig,
    userId: UserId,
  ): Promise<void>;
}
