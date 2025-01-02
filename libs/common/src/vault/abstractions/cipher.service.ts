// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { LocalData } from "@bitwarden/common/vault/models/data/local.data";
import { UserKeyRotationDataProvider } from "@bitwarden/key-management";

import { SymmetricCryptoKey } from "../../../../key-management/src/cryptography/domain/symmetric-crypto-key";
import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { CipherId, CollectionId, OrganizationId, UserId } from "../../types/guid";
import { UserKey } from "../../types/key";
import { CipherType } from "../enums/cipher-type";
import { CipherData } from "../models/data/cipher.data";
import { Cipher } from "../models/domain/cipher";
import { Field } from "../models/domain/field";
import { CipherWithIdRequest } from "../models/request/cipher-with-id.request";
import { CipherView } from "../models/view/cipher.view";
import { FieldView } from "../models/view/field.view";
import { AddEditCipherInfo } from "../types/add-edit-cipher-info";

export abstract class CipherService implements UserKeyRotationDataProvider<CipherWithIdRequest> {
  cipherViews$: Observable<CipherView[]>;
  ciphers$: Observable<Record<CipherId, CipherData>>;
  localData$: Observable<Record<CipherId, LocalData>>;
  /**
   *  An observable monitoring the add/edit cipher info saved to memory.
   */
  addEditCipherInfo$: Observable<AddEditCipherInfo>;
  clearCache: (userId?: string) => Promise<void>;
  encrypt: (
    model: CipherView,
    userId: UserId,
    keyForEncryption?: SymmetricCryptoKey,
    keyForCipherKeyDecryption?: SymmetricCryptoKey,
    originalCipher?: Cipher,
  ) => Promise<Cipher>;
  encryptFields: (fieldsModel: FieldView[], key: SymmetricCryptoKey) => Promise<Field[]>;
  encryptField: (fieldModel: FieldView, key: SymmetricCryptoKey) => Promise<Field>;
  get: (id: string) => Promise<Cipher>;
  getAll: () => Promise<Cipher[]>;
  getAllDecrypted: () => Promise<CipherView[]>;
  getAllDecryptedForGrouping: (groupingId: string, folder?: boolean) => Promise<CipherView[]>;
  getAllDecryptedForUrl: (
    url: string,
    includeOtherTypes?: CipherType[],
    defaultMatch?: UriMatchStrategySetting,
  ) => Promise<CipherView[]>;
  filterCiphersForUrl: (
    ciphers: CipherView[],
    url: string,
    includeOtherTypes?: CipherType[],
    defaultMatch?: UriMatchStrategySetting,
  ) => Promise<CipherView[]>;
  getAllFromApiForOrganization: (organizationId: string) => Promise<CipherView[]>;
  /**
   * Gets ciphers belonging to the specified organization that the user has explicit collection level access to.
   * Ciphers that are not assigned to any collections are only included for users with admin access.
   */
  getManyFromApiForOrganization: (organizationId: string) => Promise<CipherView[]>;
  getLastUsedForUrl: (url: string, autofillOnPageLoad: boolean) => Promise<CipherView>;
  getLastLaunchedForUrl: (url: string, autofillOnPageLoad: boolean) => Promise<CipherView>;
  getNextCipherForUrl: (url: string) => Promise<CipherView>;
  updateLastUsedIndexForUrl: (url: string) => void;
  updateLastUsedDate: (id: string) => Promise<void>;
  updateLastLaunchedDate: (id: string) => Promise<void>;
  saveNeverDomain: (domain: string) => Promise<void>;
  /**
   * Create a cipher with the server
   *
   * @param cipher The cipher to create
   * @param orgAdmin If true, the request is submitted as an organization admin request
   *
   * @returns A promise that resolves to the created cipher
   */
  createWithServer: (cipher: Cipher, orgAdmin?: boolean) => Promise<Cipher>;
  /**
   * Update a cipher with the server
   * @param cipher The cipher to update
   * @param orgAdmin If true, the request is submitted as an organization admin request
   * @param isNotClone If true, the cipher is not a clone and should be treated as a new cipher
   *
   * @returns A promise that resolves to the updated cipher
   */
  updateWithServer: (cipher: Cipher, orgAdmin?: boolean, isNotClone?: boolean) => Promise<Cipher>;
  shareWithServer: (
    cipher: CipherView,
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
  ) => Promise<any>;
  shareManyWithServer: (
    ciphers: CipherView[],
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
  ) => Promise<any>;
  saveAttachmentWithServer: (
    cipher: Cipher,
    unencryptedFile: any,
    userId: UserId,
    admin?: boolean,
  ) => Promise<Cipher>;
  saveAttachmentRawWithServer: (
    cipher: Cipher,
    filename: string,
    data: ArrayBuffer,
    userId: UserId,
    admin?: boolean,
  ) => Promise<Cipher>;
  /**
   * Save the collections for a cipher with the server
   *
   * @param cipher The cipher to save collections for
   *
   * @returns A promise that resolves when the collections have been saved
   */
  saveCollectionsWithServer: (cipher: Cipher) => Promise<Cipher>;

  /**
   * Save the collections for a cipher with the server as an admin.
   * Used for Unassigned ciphers or when the user only has admin access to the cipher (not assigned normally).
   * @param cipher
   */
  saveCollectionsWithServerAdmin: (cipher: Cipher) => Promise<Cipher>;
  /**
   * Bulk update collections for many ciphers with the server
   * @param orgId
   * @param cipherIds
   * @param collectionIds
   * @param removeCollections - If true, the collections will be removed from the ciphers, otherwise they will be added
   */
  bulkUpdateCollectionsWithServer: (
    orgId: OrganizationId,
    cipherIds: CipherId[],
    collectionIds: CollectionId[],
    removeCollections: boolean,
  ) => Promise<void>;
  /**
   * Update the local store of CipherData with the provided data. Values are upserted into the existing store.
   *
   * @param cipher The cipher data to upsert. Can be a single CipherData object or an array of CipherData objects.
   * @returns A promise that resolves to a record of updated cipher store, keyed by their cipher ID. Returns all ciphers, not just those updated
   */
  upsert: (cipher: CipherData | CipherData[]) => Promise<Record<CipherId, CipherData>>;
  replace: (ciphers: { [id: string]: CipherData }, userId: UserId) => Promise<any>;
  clear: (userId?: string) => Promise<void>;
  moveManyWithServer: (ids: string[], folderId: string) => Promise<any>;
  delete: (id: string | string[]) => Promise<any>;
  deleteWithServer: (id: string, asAdmin?: boolean) => Promise<any>;
  deleteManyWithServer: (ids: string[], asAdmin?: boolean) => Promise<any>;
  deleteAttachment: (id: string, attachmentId: string) => Promise<void>;
  deleteAttachmentWithServer: (id: string, attachmentId: string) => Promise<void>;
  sortCiphersByLastUsed: (a: CipherView, b: CipherView) => number;
  sortCiphersByLastUsedThenName: (a: CipherView, b: CipherView) => number;
  getLocaleSortingFunction: () => (a: CipherView, b: CipherView) => number;
  softDelete: (id: string | string[]) => Promise<any>;
  softDeleteWithServer: (id: string, asAdmin?: boolean) => Promise<any>;
  softDeleteManyWithServer: (ids: string[], asAdmin?: boolean) => Promise<any>;
  restore: (
    cipher: { id: string; revisionDate: string } | { id: string; revisionDate: string }[],
  ) => Promise<any>;
  restoreWithServer: (id: string, asAdmin?: boolean) => Promise<any>;
  restoreManyWithServer: (ids: string[], orgId?: string) => Promise<void>;
  getKeyForCipherKeyDecryption: (cipher: Cipher, userId: UserId) => Promise<any>;
  setAddEditCipherInfo: (value: AddEditCipherInfo) => Promise<void>;
  /**
   * Returns user ciphers re-encrypted with the new user key.
   * @param originalUserKey the original user key
   * @param newUserKey the new user key
   * @param userId the user id
   * @throws Error if new user key is null
   * @returns a list of user ciphers that have been re-encrypted with the new user key
   */
  getRotatedData: (
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ) => Promise<CipherWithIdRequest[]>;
  getNextCardCipher: () => Promise<CipherView>;
  getNextIdentityCipher: () => Promise<CipherView>;
}
