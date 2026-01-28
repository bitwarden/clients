import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * Result of decrypting all ciphers, containing both successes and failures.
 */
export interface DecryptAllCiphersResult {
  /** Successfully decrypted cipher views */
  successes: CipherView[];
  /** Cipher views that failed to decrypt (with decryptionFailure flag set) */
  failures: CipherView[];
}

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

  /**
   * Deletes a cipher on the server using the SDK.
   *
   * @param id The cipher ID to delete
   * @param userId The user ID to use for SDK client
   * @param asAdmin Whether this is an organization admin operation
   * @returns A promise that resolves when the cipher is deleted
   */
  abstract deleteWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<void>;

  /**
   * Deletes multiple ciphers on the server using the SDK.
   *
   * @param ids The cipher IDs to delete
   * @param userId The user ID to use for SDK client
   * @param asAdmin Whether this is an organization admin operation
   * @param orgId The organization ID (required when asAdmin is true)
   * @returns A promise that resolves when the ciphers are deleted
   */
  abstract deleteManyWithServer(
    ids: string[],
    userId: UserId,
    asAdmin?: boolean,
    orgId?: OrganizationId,
  ): Promise<void>;

  /**
   * Soft deletes a cipher on the server using the SDK.
   *
   * @param id The cipher ID to soft delete
   * @param userId The user ID to use for SDK client
   * @param asAdmin Whether this is an organization admin operation
   * @returns A promise that resolves when the cipher is soft deleted
   */
  abstract softDeleteWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<void>;

  /**
   * Soft deletes multiple ciphers on the server using the SDK.
   *
   * @param ids The cipher IDs to soft delete
   * @param userId The user ID to use for SDK client
   * @param asAdmin Whether this is an organization admin operation
   * @param orgId The organization ID (required when asAdmin is true)
   * @returns A promise that resolves when the ciphers are soft deleted
   */
  abstract softDeleteManyWithServer(
    ids: string[],
    userId: UserId,
    asAdmin?: boolean,
    orgId?: OrganizationId,
  ): Promise<void>;

  /**
   * Restores a soft-deleted cipher on the server using the SDK.
   *
   * @param id The cipher ID to restore
   * @param userId The user ID to use for SDK client
   * @param asAdmin Whether this is an organization admin operation
   * @returns A promise that resolves when the cipher is restored
   */
  abstract restoreWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<void>;

  /**
   * Restores multiple soft-deleted ciphers on the server using the SDK.
   *
   * @param ids The cipher IDs to restore
   * @param userId The user ID to use for SDK client
   * @param orgId The organization ID (determines whether to use admin API)
   * @returns A promise that resolves when the ciphers are restored
   */
  abstract restoreManyWithServer(ids: string[], userId: UserId, orgId?: string): Promise<void>;

  /**
   * Lists and decrypts all ciphers from state using the SDK.
   *
   * @param userId The user ID to use for SDK client
   * @returns A promise that resolves to the decrypt result containing successes and failures
   */
  abstract getAllDecrypted(userId: UserId): Promise<DecryptAllCiphersResult>;

  /**
   * Fetches and decrypts all ciphers for an organization from the API using the SDK.
   *
   * @param organizationId The organization ID to fetch ciphers for
   * @param userId The user ID to use for SDK client
   * @param includeMemberItems Whether to include member items
   * @returns A promise that resolves to the decrypted cipher views
   */
  abstract getAllFromApiForOrganization(
    organizationId: string,
    userId: UserId,
    includeMemberItems: boolean,
  ): Promise<CipherView[]>;
}
