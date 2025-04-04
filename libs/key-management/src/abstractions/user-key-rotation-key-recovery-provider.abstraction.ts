import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

/**
 * Constructs key rotation requests for key recovery encryption of the userkey.
 * @typeparam TRequest A request model that contains the newly encrypted userkey must have an id property
 */
export interface UserKeyRotationKeyRecoveryProvider<
  TRequest extends { id: string } | { organizationId: string },
  TPublicKeyData,
> {
  /**
   * Get the public keys for this recovery method from the server.
   * WARNING these are NOT trusted, and need to either be manually trusted by the user, or compared against
   * a signed trust database for the user. THE SERVER CAN SPOOF THESE.
   */
  getPublicKeys(userId: UserId): Promise<TPublicKeyData[]>;

  /**
   * Provides re-encrypted data for the user key rotation process
   * @param newUserKey The new user key
   * @param trustedPublicKeys The public keys that the user trusted
   * @param userId The owner of the data, useful for fetching data
   * @returns A list of data that has been re-encrypted with the new user key
   */
  getRotatedData(
    newUserKey: UserKey,
    trustedPublicKeys: Uint8Array[],
    userId: UserId,
  ): Promise<TRequest[]>;
}
