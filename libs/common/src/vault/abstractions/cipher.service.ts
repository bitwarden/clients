import { Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { UserKeyRotationDataProvider } from "@bitwarden/key-management";
import { CipherListView } from "@bitwarden/sdk-internal";

import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CipherId, CollectionId, OrganizationId, UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { CipherType } from "../enums/cipher-type";
import { CipherData } from "../models/data/cipher.data";
import { LocalData } from "../models/data/local.data";
import { Cipher } from "../models/domain/cipher";
import { Field } from "../models/domain/field";
import { CipherWithIdRequest } from "../models/request/cipher-with-id.request";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { FieldView } from "../models/view/field.view";
import { AddEditCipherInfo } from "../types/add-edit-cipher-info";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

export type EncryptionContext = {
  cipher: Cipher;
  /** The Id of the user that encrypted the cipher. It should always represent a UserId, even for Organization-owned ciphers */
  encryptedFor: UserId;
};

export abstract class CipherService implements UserKeyRotationDataProvider<CipherWithIdRequest> {
  abstract cipherViews$(userId: UserId): Observable<CipherView[]>;
  abstract cipherListViews$(userId: UserId): Observable<CipherListView[] | CipherView[]>;
  abstract ciphers$(userId: UserId): Observable<Record<CipherId, CipherData>>;
  abstract localData$(userId: UserId): Observable<Record<CipherId, LocalData>>;
  /**
   * Emits decrypted (or list-view) ciphers merged with their LocalData.
   *
   * The emitted items must be treated as {@link CipherViewLike},
   * since the underlying implementation may emit either `CipherView`
   * or `CipherListView` depending on feature flags.
   *
   * Never emits `null`; always emits an array (empty or populated).
   */
  abstract ciphersWithLocalData$(userId: UserId): Observable<CipherViewLike[]>;
  /**
   *  An observable monitoring the add/edit cipher info saved to memory.
   */
  abstract addEditCipherInfo$(userId: UserId): Observable<AddEditCipherInfo>;
  /**
   * Observable that emits an array of cipherViews that failed to decrypt. Does not emit until decryption has completed.
   *
   * An empty array indicates that all ciphers were successfully decrypted.
   */
  abstract failedToDecryptCiphers$(userId: UserId): Observable<CipherView[] | null>;
  abstract clearCache(userId: UserId): Promise<void>;
  abstract encrypt(
    model: CipherView,
    userId: UserId,
    keyForEncryption?: SymmetricCryptoKey,
    keyForCipherKeyDecryption?: SymmetricCryptoKey,
    originalCipher?: Cipher,
  ): Promise<EncryptionContext>;
  abstract encryptFields(fieldsModel: FieldView[], key: SymmetricCryptoKey): Promise<Field[]>;
  abstract encryptField(fieldModel: FieldView, key: SymmetricCryptoKey): Promise<Field>;
  abstract get(id: string, userId: UserId): Promise<Cipher>;
  abstract getAll(userId: UserId): Promise<Cipher[]>;
  abstract getAllDecrypted(userId: UserId): Promise<CipherView[]>;
  abstract getAllDecryptedForGrouping(
    groupingId: string,
    userId: UserId,
    folder?: boolean,
  ): Promise<CipherView[]>;
  abstract getAllDecryptedForUrl(
    url: string,
    userId: UserId,
    includeOtherTypes?: CipherType[],
    defaultMatch?: UriMatchStrategySetting,
    /** When true, will override the match strategy for the cipher if it is Never. */
    overrideNeverMatchStrategy?: true,
  ): Promise<CipherView[]>;
  abstract filterCiphersForUrl<C extends CipherViewLike = CipherView>(
    ciphers: C[],
    url: string,
    includeOtherTypes?: CipherType[],
    defaultMatch?: UriMatchStrategySetting,
    /** When true, will override the match strategy for the cipher if it is Never. */
    overrideNeverMatchStrategy?: true,
  ): Promise<C[]>;
  abstract getAllFromApiForOrganization(
    organizationId: string,
    includeMemberItems?: boolean,
  ): Promise<CipherView[]>;
  /**
   * Gets ciphers belonging to the specified organization that the user has explicit collection level access to.
   * Ciphers that are not assigned to any collections are only included for users with admin access.
   */
  abstract getManyFromApiForOrganization(organizationId: string): Promise<CipherView[]>;
  abstract getLastUsedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView>;
  abstract getLastLaunchedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView>;
  abstract getNextCipherForUrl(url: string, userId: UserId): Promise<CipherView>;
  abstract updateLastUsedIndexForUrl(url: string): void;
  abstract updateLastUsedDate(id: string, userId: UserId): Promise<void>;
  abstract updateLastLaunchedDate(id: string, userId: UserId): Promise<void>;
  abstract saveNeverDomain(domain: string): Promise<void>;
  /**
   * Create a cipher with the server
   *
   * @param cipher The cipher to create
   * @param orgAdmin If true, the request is submitted as an organization admin request
   *
   * @returns A promise that resolves to the created cipher
   */
  abstract createWithServer(
    { cipher, encryptedFor }: EncryptionContext,
    orgAdmin?: boolean,
  ): Promise<Cipher>;
  /**
   * Update a cipher with the server
   * @param cipher The cipher to update
   * @param orgAdmin If true, the request is submitted as an organization admin request
   * @param isNotClone If true, the cipher is not a clone and should be treated as a new cipher
   *
   * @returns A promise that resolves to the updated cipher
   */
  abstract updateWithServer(
    { cipher, encryptedFor }: EncryptionContext,
    orgAdmin?: boolean,
    isNotClone?: boolean,
  ): Promise<Cipher>;

  /**
   * Move a cipher to an organization by re-encrypting its keys with the organization's key.
   * @param cipher The cipher to move
   * @param organizationId The Id of the organization to move the cipher to
   * @param collectionIds The collection Ids to assign the cipher to in the organization
   * @param userId The Id of the user performing the operation
   * @param originalCipher Optional original cipher that will be used to compare/update password history
   */
  abstract shareWithServer(
    cipher: CipherView,
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
    originalCipher?: Cipher,
  ): Promise<Cipher>;
  abstract shareManyWithServer(
    ciphers: CipherView[],
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
  ): Promise<any>;
  abstract saveAttachmentWithServer(
    cipher: Cipher,
    unencryptedFile: any,
    userId: UserId,
    admin?: boolean,
  ): Promise<Cipher>;
  abstract saveAttachmentRawWithServer(
    cipher: Cipher,
    filename: string,
    data: ArrayBuffer,
    userId: UserId,
    admin?: boolean,
  ): Promise<Cipher>;
  /**
   * Save the collections for a cipher with the server
   *
   * @param cipher The cipher to save collections for
   * @param userId The user ID
   *
   * @returns A promise that resolves when the collections have been saved
   */
  abstract saveCollectionsWithServer(cipher: Cipher, userId: UserId): Promise<Cipher>;

  /**
   * Save the collections for a cipher with the server as an admin.
   * Used for Unassigned ciphers or when the user only has admin access to the cipher (not assigned normally).
   * @param cipher
   */
  abstract saveCollectionsWithServerAdmin(cipher: Cipher): Promise<Cipher>;
  /**
   * Bulk update collections for many ciphers with the server
   * @param orgId
   * @param userId
   * @param cipherIds
   * @param collectionIds
   * @param removeCollections - If true, the collections will be removed from the ciphers, otherwise they will be added
   */
  abstract bulkUpdateCollectionsWithServer(
    orgId: OrganizationId,
    userId: UserId,
    cipherIds: CipherId[],
    collectionIds: CollectionId[],
    removeCollections: boolean,
  ): Promise<void>;
  /**
   * Update the local store of CipherData with the provided data. Values are upserted into the existing store.
   *
   * @param cipher The cipher data to upsert. Can be a single CipherData object or an array of CipherData objects.
   * @returns A promise that resolves to a record of updated cipher store, keyed by their cipher ID. Returns all ciphers, not just those updated
   */
  abstract upsert(cipher: CipherData | CipherData[]): Promise<Record<CipherId, CipherData>>;
  abstract replace(ciphers: { [id: string]: CipherData }, userId: UserId): Promise<any>;
  abstract clear(userId?: string): Promise<void>;
  abstract moveManyWithServer(ids: string[], folderId: string, userId: UserId): Promise<any>;
  abstract delete(id: string | string[], userId: UserId): Promise<any>;
  abstract deleteWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract deleteManyWithServer(ids: string[], userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract deleteAttachment(
    id: string,
    revisionDate: string,
    attachmentId: string,
    userId: UserId,
  ): Promise<CipherData>;
  abstract deleteAttachmentWithServer(
    id: string,
    attachmentId: string,
    userId: UserId,
    admin: boolean,
  ): Promise<CipherData>;
  abstract sortCiphersByLastUsed(a: CipherViewLike, b: CipherViewLike): number;
  abstract sortCiphersByLastUsedThenName(a: CipherViewLike, b: CipherViewLike): number;
  abstract getLocaleSortingFunction(): (a: CipherViewLike, b: CipherViewLike) => number;
  abstract softDelete(id: string | string[], userId: UserId): Promise<any>;
  abstract softDeleteWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract softDeleteManyWithServer(ids: string[], userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract restore(
    cipher: { id: string; revisionDate: string } | { id: string; revisionDate: string }[],
    userId: UserId,
  ): Promise<any>;
  abstract restoreWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract restoreManyWithServer(ids: string[], userId: UserId, orgId?: string): Promise<void>;
  abstract getKeyForCipherKeyDecryption(cipher: Cipher, userId: UserId): Promise<any>;
  abstract setAddEditCipherInfo(value: AddEditCipherInfo, userId: UserId): Promise<void>;
  /**
   * Returns user ciphers re-encrypted with the new user key.
   * @param originalUserKey the original user key
   * @param newUserKey the new user key
   * @param userId the user id
   * @throws Error if new user key is null
   * @returns a list of user ciphers that have been re-encrypted with the new user key
   */
  abstract getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<CipherWithIdRequest[]>;
  abstract getNextCardCipher(userId: UserId): Promise<CipherView>;
  abstract getNextIdentityCipher(userId: UserId): Promise<CipherView>;

  /**
   * Decrypts a cipher using either the SDK or the legacy method based on the feature flag.
   * @param cipher The cipher to decrypt.
   * @param userId The user ID to use for decryption.
   * @returns A promise that resolves to the decrypted cipher view.
   */
  abstract decrypt(cipher: Cipher, userId: UserId): Promise<CipherView>;
  /**
   * Decrypts an attachment's content from a response object.
   *
   * @param cipherId The ID of the cipher that owns the attachment
   * @param attachment The attachment view object
   * @param response The response object containing the encrypted content
   * @param userId The user ID whose key will be used for decryption
   * @param useLegacyDecryption When true, forces the use of the legacy decryption method
   * even when the SDK feature is enabled. This is helpful for domains of
   * the application that have yet to be moved into the SDK, i.e. emergency access.
   * TODO: PM-25469 - this should be obsolete once emergency access is moved to the SDK.
   *
   * @returns A promise that resolves to the decrypted content
   */
  abstract getDecryptedAttachmentBuffer(
    cipherId: CipherId,
    attachment: AttachmentView,
    response: Response,
    userId: UserId,
    useLegacyDecryption?: boolean,
  ): Promise<Uint8Array | null>;

  /**
   * Decrypts the full `CipherView` for a given `CipherViewLike`.
   * When a `CipherView` instance is passed, it returns it as is.
   */
  abstract getFullCipherView(c: CipherViewLike): Promise<CipherView>;
}
