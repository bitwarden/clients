import {
  CipherListView,
  CreateAttachmentRequest,
  CreatedAttachment,
} from "@bitwarden/sdk-internal";

import {
  CipherId,
  CollectionId,
  EmergencyAccessId,
  OrganizationId,
  UserId,
} from "../../types/guid";
import { Cipher } from "../models/domain/cipher";
import { CipherView } from "../models/view/cipher.view";

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
   * Updates the collections for a cipher as an org admin using the SDK.
   *
   * @param cipherId The cipher ID to update
   * @param collectionIds The new collection IDs to assign
   * @param userId The user ID to use for SDK client
   * @returns A promise that resolves to the updated cipher view
   */
  abstract saveCollectionsWithServerAdmin(
    cipherId: string,
    collectionIds: string[],
    userId: UserId,
  ): Promise<CipherView | undefined>;

  /**
   * Updates the collections for a cipher using the SDK.
   *
   * @param cipherId The cipher ID to update
   * @param collectionIds The new collection IDs to assign
   * @param userId The user ID to use for SDK client
   * @returns A promise that resolves to the updated cipher view, or undefined if unavailable
   */
  abstract saveCollectionsWithServer(
    cipherId: string,
    collectionIds: string[],
    userId: UserId,
  ): Promise<CipherView | undefined>;

  /**
   * Shares a cipher with an organization using the SDK.
   * Handles encryption and API call in one operation.
   *
   * @param cipherView The cipher view to share
   * @param organizationId The organization to share with
   * @param collectionIds The collection IDs to add the cipher to
   * @param userId The user ID to use for SDK client
   * @param originalCipherView Optional original cipher view for password history tracking
   * @returns A promise that resolves to the shared cipher (encrypted)
   */
  abstract shareWithServer(
    cipherView: CipherView,
    organizationId: OrganizationId,
    collectionIds: CollectionId[],
    userId: UserId,
    originalCipherView?: CipherView,
  ): Promise<CipherView | undefined>;

  /**
   * Shares multiple ciphers with an organization using the SDK.
   * Handles encryption and API calls in one operation.
   *
   * @param cipherViews The cipher views to share
   * @param organizationId The organization to share with
   * @param collectionIds The collection IDs to add the ciphers to
   * @param userId The user ID to use for SDK client
   * @returns A promise that resolves to the shared ciphers (encrypted)
   */
  abstract shareManyWithServer(
    cipherViews: CipherView[],
    organizationId: OrganizationId,
    collectionIds: CollectionId[],
    userId: UserId,
  ): Promise<CipherView[]>;

  /**
   * Deletes an attachment from a cipher on the server using the SDK.
   *
   * @param cipherId The cipher that owns the attachment
   * @param attachmentId The attachment to delete
   * @param userId The user ID to use for SDK client
   * @param asAdmin Whether this is an organization admin operation
   * @returns A promise that resolves to the updated cipher
   */
  abstract deleteAttachmentWithServer(
    cipherId: CipherId,
    attachmentId: string,
    userId: UserId,
    asAdmin?: boolean,
  ): Promise<Cipher | undefined>;

  /**
   * Returns a download URL for the given attachment via the SDK. Routes through the
   * regular, admin, or emergency-access endpoint based on the provided options:
   *
   * - `asAdmin: true` → admin endpoint (organization admins / managed items).
   * - `emergencyAccessId` set → emergency-access endpoint (grantee viewing grantor's cipher).
   * - neither → regular user endpoint (with 404 fallback to repo-stored URL).
   *
   * The `asAdmin` and `emergencyAccessId` options are mutually exclusive.
   *
   * @param cipherId The cipher that owns the attachment
   * @param attachmentId The attachment to get a download URL for
   * @param userId The user ID to use for SDK client
   * @param options Route selection (admin or emergency access)
   */
  abstract getAttachmentDownloadUrl(
    cipherId: CipherId,
    attachmentId: string,
    userId: UserId,
    options?: { asAdmin?: boolean; emergencyAccessId?: EmergencyAccessId },
  ): Promise<string>;

  /**
   * Opens a new attachment slot on the server via the SDK. The caller is responsible for
   * pushing the encrypted bytes to the returned `uploadUrl` using the indicated
   * `fileUploadType` transport.
   *
   * @param cipherId The cipher to attach the new file to
   * @param request Encrypted attachment metadata (key, fileName, fileSize, lastKnownRevisionDate)
   * @param userId The user ID to use for SDK client
   */
  abstract createAttachment(
    cipherId: CipherId,
    request: CreateAttachmentRequest,
    userId: UserId,
  ): Promise<CreatedAttachment>;

  /**
   * Fetches a refreshed upload URL for an attachment whose initial upload URL has expired.
   *
   * @param cipherId The cipher that owns the attachment
   * @param attachmentId The attachment whose upload URL needs renewing
   * @param userId The user ID to use for SDK client
   */
  abstract renewAttachmentUploadUrl(
    cipherId: CipherId,
    attachmentId: string,
    userId: UserId,
  ): Promise<string>;

  /**
   * Upgrades a legacy attachment to the new attachment system via the SDK.
   *
   * @param cipherId The cipher that owns the legacy attachment
   * @param attachmentId The legacy attachment to upgrade
   * @param userId The user ID to use for SDK client
   */
  abstract upgradeAttachment(
    cipherId: CipherId,
    attachmentId: string,
    userId: UserId,
  ): Promise<CipherView | undefined>;

  /**
   * Lists and decrypts all ciphers from state using the SDK.
   *
   * @param userId The user ID to use for SDK client
   * @returns A promise that resolves to the decrypt result containing successes and failures
   */
  abstract getAllDecrypted(userId: UserId): Promise<DecryptAllCiphersResult>;

  /**
   * Fetches all ciphers for an organization from the API using the SDK.
   * Returns encrypted ciphers for on-demand decryption and lightweight list views for display.
   *
   * @param organizationId The organization ID to fetch ciphers for
   * @param userId The user ID to use for SDK client
   * @param includeMemberItems Whether to include member items
   * @returns A promise that resolves to the encrypted ciphers and decrypted list views
   */
  abstract getAllFromApiForOrganization(
    organizationId: string,
    userId: UserId,
    includeMemberItems: boolean,
  ): Promise<[Cipher[], CipherListView[]]>;

  /**
   * Fetches the ciphers an organization member is assigned to (via collections) using the SDK.
   * Returns encrypted ciphers for on-demand decryption and lightweight list views for display.
   *
   * @param organizationId The organization ID to fetch ciphers for
   * @param userId The user ID to use for SDK client
   * @returns A promise that resolves to the encrypted ciphers and decrypted list views
   */
  abstract getManyFromApiForOrganization(
    organizationId: string,
    userId: UserId,
  ): Promise<[Cipher[], CipherListView[]]>;

  /**
   * Bulk update collections for many ciphers using the SDK.
   * When `removeCollections` is true the collections are removed from each cipher,
   * otherwise they are added without introducing duplicates.
   *
   * @param orgId The organization that owns the ciphers and collections
   * @param userId The user ID to use for SDK client
   * @param cipherIds The ciphers to update
   * @param collectionIds The collections to add or remove
   * @param removeCollections If true, removes the collections; otherwise adds them
   */
  abstract bulkUpdateCollectionsWithServer(
    orgId: OrganizationId,
    userId: UserId,
    cipherIds: CipherId[],
    collectionIds: CollectionId[],
    removeCollections: boolean,
  ): Promise<void>;

  /**
   * Moves multiple ciphers to a folder using the SDK, or clears the folder when `folderId` is null.
   *
   * @param ids The cipher IDs to move
   * @param folderId The destination folder ID, or null to clear the folder
   * @param userId The user ID to use for SDK client
   */
  abstract moveManyWithServer(
    ids: string[],
    folderId: string | null,
    userId: UserId,
  ): Promise<void>;
}
