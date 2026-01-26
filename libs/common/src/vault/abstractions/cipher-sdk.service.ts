import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Service responsible for cipher operations using the SDK.
 */
export abstract class CipherSdkService {
  /**
   * Creates a new cipher on the server using the SDK.
   *
   * @param cipherView The cipher view to create
   * @param userId The user ID to use for SDK client
   * @param orgAdmin Whether this is an organization admin operation
   * @returns A promise that resolves to the created cipher view
   */
  abstract createWithServer(
    cipherView: CipherView,
    userId: UserId,
    orgAdmin?: boolean,
  ): Promise<CipherView | undefined>;

  /**
   * Updates a cipher on the server using the SDK.
   *
   * @param cipher The cipher view to update
   * @param userId The user ID to use for SDK client
   * @param originalCipherView The original cipher view before changes (optional, used for admin operations)
   * @param orgAdmin Whether this is an organization admin operation
   * @returns A promise that resolves to the updated cipher view
   */
  abstract updateWithServer(
    cipher: CipherView,
    userId: UserId,
    originalCipherView?: CipherView,
    orgAdmin?: boolean,
  ): Promise<CipherView | undefined>;
}
