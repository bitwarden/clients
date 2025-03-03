// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { UserKeyRotationDataProvider } from "@bitwarden/key-management";

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
import { CipherView } from "../models/view/cipher.view";
import { FieldView } from "../models/view/field.view";
import { AddEditCipherInfo } from "../types/add-edit-cipher-info";

export abstract class CipherService implements UserKeyRotationDataProvider<CipherWithIdRequest> {
  abstract cipherViews$(userId: UserId): Observable<CipherView[]>;
  abstract ciphers$(userId: UserId): Observable<Record<CipherId, CipherData>>;
  abstract localData$(userId: UserId): Observable<Record<CipherId, LocalData>>;
  /**
   *  An observable monitoring the add/edit cipher info saved to memory.
   */
  abstract addEditCipherInfo$(userId: UserId): Observable<AddEditCipherInfo>;
  /**
   * Observable that emits an array of cipherViews that failed to decrypt. Does not emit until decryption has completed.
   *
   * An empty array indicates that all ciphers were successfully decrypted.
   */
  abstract failedToDecryptCiphers$(userId: UserId): Observable<CipherView[]>;
  abstract clearCache(userId: UserId): Promise<void>;
  abstract encrypt(
    model: CipherView,
    userId: UserId,
    keyForEncryption?: SymmetricCryptoKey,
    keyForCipherKeyDecryption?: SymmetricCryptoKey,
    originalCipher?: Cipher,
  ): Promise<Cipher>;
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
  ): Promise<CipherView[]>;
  abstract filterCiphersForUrl(
    ciphers: CipherView[],
    url: string,
    includeOtherTypes?: CipherType[],
    defaultMatch?: UriMatchStrategySetting,
  ): Promise<CipherView[]>;
  abstract getAllFromApiForOrganization(organizationId: string): Promise<CipherView[]>;
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
  abstract createWithServer(cipher: Cipher, orgAdmin?: boolean): Promise<Cipher>;
  /**
   * Update a cipher with the server
   * @param cipher The cipher to update
   * @param orgAdmin If true, the request is submitted as an organization admin request
   * @param isNotClone If true, the cipher is not a clone and should be treated as a new cipher
   *
   * @returns A promise that resolves to the updated cipher
   */
  abstract updateWithServer(
    cipher: Cipher,
    orgAdmin?: boolean,
    isNotClone?: boolean,
  ): Promise<Cipher>;
  abstract shareWithServer(
    cipher: CipherView,
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
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
  ): Promise<CipherData>;
  abstract sortCiphersByLastUsed(a: CipherView, b: CipherView): number;
  abstract sortCiphersByLastUsedThenName(a: CipherView, b: CipherView): number;
  abstract getLocaleSortingFunction(): (a: CipherView, b: CipherView) => number;
  abstract softDelete(id: string | string[], userId: UserId): Promise<any>;
  abstract softDeleteWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract softDeleteManyWithServer(ids: string[], userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract restore(
    cipher: { id: string; revisionDate: string } | { id: string; revisionDate: string }[],
    userId: UserId,
  ): Promise<any>;
  abstract restoreWithServer(id: string, userId: UserId, asAdmin?: boolean): Promise<any>;
  abstract restoreManyWithServer(ids: string[], orgId?: string): Promise<void>;
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
}
