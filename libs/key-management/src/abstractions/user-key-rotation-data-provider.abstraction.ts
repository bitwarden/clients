import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

/**
 * Constructs key rotation requests for data encryption by the user key.
 * @typeparam TRequest A request model that contains re-encrypted data, must have an id property
 */
export interface UserKeyRotationDataProvider<
  TRequest extends { id: string } | { organizationId: string },
> {
  /**
   * Provides re-encrypted data for the user key rotation process
   * @param originalUserKey The original user key, useful for decrypting data
   * @param newUserKey The new user key to use for re-encryption
   * @param userId The owner of the data, useful for fetching data
   * @returns A list of data that has been re-encrypted with the new user key
   */
  getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<TRequest[]>;
}
