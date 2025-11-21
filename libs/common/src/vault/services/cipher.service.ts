// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  Subject,
  switchMap,
  tap,
} from "rxjs";
import { SemVer } from "semver";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { CipherListView } from "@bitwarden/sdk-internal";

import { ApiService } from "../../abstractions/api.service";
import { AccountService } from "../../auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "../../autofill/services/autofill-settings.service";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../key-management/crypto/models/enc-string";
import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { ErrorResponse } from "../../models/response/error.response";
import { ListResponse } from "../../models/response/list.response";
import { View } from "../../models/view/view";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../platform/misc/utils";
import Domain from "../../platform/models/domain/domain-base";
import { EncArrayBuffer } from "../../platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { StateProvider } from "../../platform/state";
import { CipherId, CollectionId, OrganizationId, UserId } from "../../types/guid";
import { OrgKey, UserKey } from "../../types/key";
import { filterOutNullish, perUserCache$ } from "../../vault/utils/observable-utilities";
import { CipherEncryptionService } from "../abstractions/cipher-encryption.service";
import {
  CipherService as CipherServiceAbstraction,
  EncryptionContext,
} from "../abstractions/cipher.service";
import { CipherFileUploadService } from "../abstractions/file-upload/cipher-file-upload.service";
import { SearchService } from "../abstractions/search.service";
import { FieldType } from "../enums";
import { CipherType } from "../enums/cipher-type";
import { CipherData } from "../models/data/cipher.data";
import { LocalData } from "../models/data/local.data";
import { Attachment } from "../models/domain/attachment";
import { Card } from "../models/domain/card";
import { Cipher } from "../models/domain/cipher";
import { Fido2Credential } from "../models/domain/fido2-credential";
import { Field } from "../models/domain/field";
import { Identity } from "../models/domain/identity";
import { Login } from "../models/domain/login";
import { LoginUri } from "../models/domain/login-uri";
import { Password } from "../models/domain/password";
import { SecureNote } from "../models/domain/secure-note";
import { SortedCiphersCache } from "../models/domain/sorted-ciphers-cache";
import { SshKey } from "../models/domain/ssh-key";
import { CipherBulkDeleteRequest } from "../models/request/cipher-bulk-delete.request";
import { CipherBulkMoveRequest } from "../models/request/cipher-bulk-move.request";
import { CipherBulkRestoreRequest } from "../models/request/cipher-bulk-restore.request";
import { CipherBulkShareRequest } from "../models/request/cipher-bulk-share.request";
import { CipherBulkUpdateCollectionsRequest } from "../models/request/cipher-bulk-update-collections.request";
import { CipherCollectionsRequest } from "../models/request/cipher-collections.request";
import { CipherCreateRequest } from "../models/request/cipher-create.request";
import { CipherPartialRequest } from "../models/request/cipher-partial.request";
import { CipherShareRequest } from "../models/request/cipher-share.request";
import { CipherWithIdRequest } from "../models/request/cipher-with-id.request";
import { CipherRequest } from "../models/request/cipher.request";
import { CipherResponse } from "../models/response/cipher.response";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { FieldView } from "../models/view/field.view";
import { PasswordHistoryView } from "../models/view/password-history.view";
import { AddEditCipherInfo } from "../types/add-edit-cipher-info";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";

import {
  ADD_EDIT_CIPHER_INFO_KEY,
  DECRYPTED_CIPHERS,
  ENCRYPTED_CIPHERS,
  FAILED_DECRYPTED_CIPHERS,
  LOCAL_DATA_KEY,
} from "./key-state/ciphers.state";

const CIPHER_KEY_ENC_MIN_SERVER_VER = new SemVer("2024.2.0");

export class CipherService implements CipherServiceAbstraction {
  private sortedCiphersCache: SortedCiphersCache = new SortedCiphersCache(
    this.sortCiphersByLastUsed,
  );
  /**
   * Observable that forces the `cipherViews$` observable for the given user to emit a null value.
   * Used to let subscribers of `cipherViews$` know that the decrypted ciphers have been cleared for the user and to
   * clear them from the shareReplay buffer created in perUserCache$().
   * @private
   */
  private clearCipherViewsForUser$: Subject<UserId> = new Subject<UserId>();

  constructor(
    private keyService: KeyService,
    private domainSettingsService: DomainSettingsService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private searchService: SearchService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private encryptService: EncryptService,
    private cipherFileUploadService: CipherFileUploadService,
    private configService: ConfigService,
    private stateProvider: StateProvider,
    private accountService: AccountService,
    private logService: LogService,
    private cipherEncryptionService: CipherEncryptionService,
    private messageSender: MessageSender,
  ) {}

  localData$(userId: UserId): Observable<Record<CipherId, LocalData>> {
    return this.localDataState(userId).state$.pipe(map((data) => data ?? {}));
  }

  /**
   * Observable that emits an object of encrypted ciphers for the active user.
   */
  ciphers$(userId: UserId): Observable<Record<CipherId, CipherData>> {
    return this.encryptedCiphersState(userId).state$.pipe(map((ciphers) => ciphers ?? {}));
  }

  /**
   * Observable that emits an array of decrypted ciphers for given userId.
   * This observable will not emit until the encrypted ciphers have either been loaded from state or after sync.
   *
   * This uses the SDK for decryption, when the `PM22134SdkCipherListView` feature flag is disabled the full `cipherViews$` observable will be emitted.
   * Usage of the {@link CipherViewLike} type is recommended to ensure both `CipherView` and `CipherListView` are supported.
   */
  cipherListViews$ = perUserCache$((userId: UserId) => {
    return this.configService.getFeatureFlag$(FeatureFlag.PM22134SdkCipherListView).pipe(
      switchMap((useSdk) => {
        if (!useSdk) {
          return this.cipherViews$(userId);
        }

        return combineLatest([
          this.encryptedCiphersState(userId).state$,
          this.localData$(userId),
          this.keyService.cipherDecryptionKeys$(userId, true),
        ]).pipe(
          filter(([cipherDataState, _, keys]) => cipherDataState != null && keys != null),
          map(([cipherDataState, localData]) =>
            Object.values(cipherDataState).map(
              (cipherData) => new Cipher(cipherData, localData?.[cipherData.id as CipherId]),
            ),
          ),
          switchMap(async (ciphers) => {
            const [decrypted, failures] = await this.decryptCiphersWithSdk(ciphers, userId, false);
            await this.setFailedDecryptedCiphers(failures, userId);
            return decrypted;
          }),
        );
      }),
    );
  });

  /**
   * Observable that emits an array of decrypted ciphers for the active user.
   * This observable will not emit until the encrypted ciphers have either been loaded from state or after sync.
   *
   * A `null` value indicates that the latest encrypted ciphers have not been decrypted yet and that
   * decryption is in progress. The latest decrypted ciphers will be emitted once decryption is complete.
   */
  cipherViews$ = perUserCache$((userId: UserId): Observable<CipherView[] | null> => {
    return combineLatest([
      this.encryptedCiphersState(userId).state$,
      this.localData$(userId),
      this.keyService.cipherDecryptionKeys$(userId),
    ]).pipe(
      filter(([ciphers, _, keys]) => ciphers != null && keys != null), // Skip if ciphers haven't been loaded yor synced yet
      switchMap(() => this.getAllDecrypted(userId)),
      tap(() => {
        this.messageSender.send("updateOverlayCiphers");
      }),
    );
  }, this.clearCipherViewsForUser$);

  addEditCipherInfo$(userId: UserId): Observable<AddEditCipherInfo> {
    return this.addEditCipherInfoState(userId).state$;
  }

  /**
   * Observable that emits an array of cipherViews that failed to decrypt. Does not emit until decryption has completed.
   *
   * An empty array indicates that all ciphers were successfully decrypted.
   */
  failedToDecryptCiphers$ = perUserCache$((userId: UserId): Observable<CipherView[]> => {
    return this.failedToDecryptCiphersState(userId).state$.pipe(
      filter((ciphers) => ciphers != null),
    );
  }, this.clearCipherViewsForUser$);

  async setDecryptedCipherCache(value: CipherView[], userId: UserId) {
    // Sometimes we might prematurely decrypt the vault and that will result in no ciphers
    // if we cache it then we may accidentally return it when it's not right, we'd rather try decryption again.
    // We still want to set null though, that is the indicator that the cache isn't valid and we should do decryption.
    if (value == null || value.length !== 0) {
      await this.setDecryptedCiphers(value, userId);
    }
    if (this.searchService != null) {
      if (value == null) {
        await this.searchService.clearIndex(userId);
      } else {
        void this.searchService.indexCiphers(userId, value);
      }
    }
  }

  async setFailedDecryptedCiphers(cipherViews: CipherView[], userId: UserId) {
    await this.stateProvider.setUserState(FAILED_DECRYPTED_CIPHERS, cipherViews, userId);
  }

  private async setDecryptedCiphers(value: CipherView[], userId: UserId) {
    const cipherViews: { [id: string]: CipherView } = {};
    value?.forEach((c) => {
      cipherViews[c.id] = c;
    });
    await this.stateProvider.setUserState(DECRYPTED_CIPHERS, cipherViews, userId);
  }

  async clearCache(userId?: UserId): Promise<void> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
    userId ??= activeUserId;
    await this.clearDecryptedCiphersState(userId);

    // Force the cached cipherView$ observable(s) to emit a null value
    this.clearCipherViewsForUser$.next(userId);
  }

  /**
   * Adjusts the cipher history for the given model by updating its history properties based on the original cipher.
   * @param model The cipher model to adjust.
   * @param userId The acting userId
   * @param originalCipher The original cipher to compare against. If not provided, it will be fetched from the store.
   * @private
   */
  private async adjustCipherHistory(model: CipherView, userId: UserId, originalCipher?: Cipher) {
    if (model.id != null) {
      if (originalCipher == null) {
        originalCipher = await this.get(model.id, userId);
      }
      if (originalCipher != null) {
        await this.updateModelfromExistingCipher(model, originalCipher, userId);
      }
      this.adjustPasswordHistoryLength(model);
    }
  }

  async encrypt(
    model: CipherView,
    userId: UserId,
    keyForCipherEncryption?: SymmetricCryptoKey,
    keyForCipherKeyDecryption?: SymmetricCryptoKey,
    originalCipher: Cipher = null,
  ): Promise<EncryptionContext> {
    await this.adjustCipherHistory(model, userId, originalCipher);

    const sdkEncryptionEnabled =
      (await this.configService.getFeatureFlag(FeatureFlag.PM22136_SdkCipherEncryption)) &&
      keyForCipherEncryption == null && // PM-23085 - SDK encryption does not currently support custom keys (e.g. key rotation)
      keyForCipherKeyDecryption == null; // PM-23348 - Or has explicit methods for re-encrypting ciphers with different keys (e.g. move to org)

    if (sdkEncryptionEnabled) {
      return await this.cipherEncryptionService.encrypt(model, userId);
    }

    const cipher = new Cipher();
    cipher.id = model.id;
    cipher.folderId = model.folderId;
    cipher.favorite = model.favorite;
    cipher.organizationId = model.organizationId;
    cipher.type = model.type;
    cipher.collectionIds = model.collectionIds;
    cipher.creationDate = model.creationDate;
    cipher.revisionDate = model.revisionDate;
    cipher.archivedDate = model.archivedDate;
    cipher.reprompt = model.reprompt;
    cipher.edit = model.edit;

    if (
      // prevent unprivileged users from migrating to cipher key encryption
      (model.viewPassword || originalCipher?.key) &&
      (await this.getCipherKeyEncryptionEnabled())
    ) {
      cipher.key = originalCipher?.key ?? null;
      const userOrOrgKey = await this.getKeyForCipherKeyDecryption(cipher, userId);
      // The keyForEncryption is only used for encrypting the cipher key, not the cipher itself, since cipher key encryption is enabled.
      // If the caller has provided a key for cipher key encryption, use it. Otherwise, use the user or org key.
      keyForCipherEncryption ||= userOrOrgKey;
      // If the caller has provided a key for cipher key decryption, use it. Otherwise, use the user or org key.
      keyForCipherKeyDecryption ||= userOrOrgKey;
      return {
        cipher: await this.encryptCipherWithCipherKey(
          model,
          cipher,
          keyForCipherEncryption,
          keyForCipherKeyDecryption,
        ),
        encryptedFor: userId,
      };
    } else {
      keyForCipherEncryption ||= await this.getKeyForCipherKeyDecryption(cipher, userId);
      // We want to ensure that the cipher key is null if cipher key encryption is disabled
      // so that decryption uses the proper key.
      cipher.key = null;
      return {
        cipher: await this.encryptCipher(model, cipher, keyForCipherEncryption),
        encryptedFor: userId,
      };
    }
  }

  async encryptAttachments(
    attachmentsModel: AttachmentView[],
    key: SymmetricCryptoKey,
  ): Promise<Attachment[]> {
    if (attachmentsModel == null || attachmentsModel.length === 0) {
      return null;
    }

    const promises: Promise<any>[] = [];
    const encAttachments: Attachment[] = [];
    attachmentsModel.forEach(async (model) => {
      const attachment = new Attachment();
      attachment.id = model.id;
      attachment.size = model.size;
      attachment.sizeName = model.sizeName;
      attachment.url = model.url;
      const promise = this.encryptObjProperty(model, attachment, { fileName: null }, key).then(
        async () => {
          if (model.key != null) {
            attachment.key = await this.encryptService.wrapSymmetricKey(model.key, key);
          }
          encAttachments.push(attachment);
        },
      );
      promises.push(promise);
    });

    await Promise.all(promises);
    return encAttachments;
  }

  async encryptFields(fieldsModel: FieldView[], key: SymmetricCryptoKey): Promise<Field[]> {
    if (!fieldsModel || !fieldsModel.length) {
      return null;
    }

    const self = this;
    const encFields: Field[] = [];
    await fieldsModel.reduce(async (promise, field) => {
      await promise;
      const encField = await self.encryptField(field, key);
      encFields.push(encField);
    }, Promise.resolve());

    return encFields;
  }

  async encryptField(fieldModel: FieldView, key: SymmetricCryptoKey): Promise<Field> {
    const field = new Field();
    field.type = fieldModel.type;
    field.linkedId = fieldModel.linkedId;
    // normalize boolean type field values
    if (fieldModel.type === FieldType.Boolean && fieldModel.value !== "true") {
      fieldModel.value = "false";
    }

    await this.encryptObjProperty(fieldModel, field, { name: null, value: null }, key);

    return field;
  }

  async encryptPasswordHistories(
    phModels: PasswordHistoryView[],
    key: SymmetricCryptoKey,
  ): Promise<Password[]> {
    if (!phModels || !phModels.length) {
      return null;
    }

    const self = this;
    const encPhs: Password[] = [];
    await phModels.reduce(async (promise, ph) => {
      await promise;
      const encPh = await self.encryptPasswordHistory(ph, key);
      encPhs.push(encPh);
    }, Promise.resolve());

    return encPhs;
  }

  async encryptPasswordHistory(
    phModel: PasswordHistoryView,
    key: SymmetricCryptoKey,
  ): Promise<Password> {
    const ph = new Password();
    ph.lastUsedDate = phModel.lastUsedDate;

    await this.encryptObjProperty(phModel, ph, { password: null }, key);

    return ph;
  }

  async get(id: string, userId: UserId): Promise<Cipher> {
    const ciphers = await firstValueFrom(this.ciphers$(userId));
    // eslint-disable-next-line
    if (ciphers == null || !ciphers.hasOwnProperty(id)) {
      return null;
    }

    const localData = await firstValueFrom(this.localData$(userId));
    const cipherId = id as CipherId;

    return new Cipher(ciphers[cipherId], localData ? localData[cipherId] : null);
  }

  async getAll(userId: UserId): Promise<Cipher[]> {
    const localData = await firstValueFrom(this.localData$(userId));
    const ciphers = await firstValueFrom(this.ciphers$(userId));
    const response: Cipher[] = [];
    for (const id in ciphers) {
      // eslint-disable-next-line
      if (ciphers.hasOwnProperty(id)) {
        const cipherId = id as CipherId;
        response.push(new Cipher(ciphers[cipherId], localData ? localData[cipherId] : null));
      }
    }
    return response;
  }

  /**
   * Decrypts all ciphers for the active user and caches them in memory. If the ciphers have already been decrypted and
   * cached, the cached ciphers are returned.
   * @deprecated Use `cipherViews$` observable instead
   */
  async getAllDecrypted(userId: UserId): Promise<CipherView[]> {
    const decCiphers = await this.getDecryptedCiphers(userId);
    if (decCiphers != null && decCiphers.length !== 0) {
      await this.reindexCiphers(userId);
      return decCiphers;
    }

    const decrypted = await this.decryptCiphers(await this.getAll(userId), userId);

    // We failed to decrypt, return empty array but do not cache
    if (decrypted == null) {
      return [];
    }

    const [newDecCiphers, failedCiphers] = decrypted;

    await this.setDecryptedCipherCache(newDecCiphers, userId);
    await this.setFailedDecryptedCiphers(failedCiphers, userId);

    return newDecCiphers;
  }

  private async getDecryptedCiphers(userId: UserId) {
    return Object.values(
      await firstValueFrom(this.decryptedCiphersState(userId).state$.pipe(map((c) => c ?? {}))),
    );
  }

  /**
   * Decrypts the provided ciphers using the provided user's keys.
   * @param ciphers
   * @param userId
   * @returns Two cipher arrays, the first containing successfully decrypted ciphers and the second containing ciphers that failed to decrypt.
   * @private
   */
  private async decryptCiphers(
    ciphers: Cipher[],
    userId: UserId,
  ): Promise<[CipherView[], CipherView[]] | null> {
    if (await this.configService.getFeatureFlag(FeatureFlag.PM19941MigrateCipherDomainToSdk)) {
      const decryptStartTime = performance.now();

      const result = await this.decryptCiphersWithSdk(ciphers, userId, true);

      this.logService.measure(decryptStartTime, "Vault", "CipherService", "decrypt complete", [
        ["Items", ciphers.length],
      ]);

      return result;
    }

    const keys = await firstValueFrom(this.keyService.cipherDecryptionKeys$(userId));
    if (keys == null || (keys.userKey == null && Object.keys(keys.orgKeys).length === 0)) {
      // return early if there are no keys to decrypt with
      return null;
    }
    // Group ciphers by orgId or under 'null' for the user's ciphers
    const grouped = ciphers.reduce(
      (agg, c) => {
        agg[c.organizationId] ??= [];
        agg[c.organizationId].push(c);
        return agg;
      },
      {} as Record<string, Cipher[]>,
    );
    const decryptStartTime = performance.now();
    const allCipherViews = (
      await Promise.all(
        Object.entries(grouped).map(async ([orgId, groupedCiphers]) => {
          const key = keys.orgKeys[orgId as OrganizationId] ?? keys.userKey;
          return await Promise.all(
            groupedCiphers.map(async (cipher) => {
              return await cipher.decrypt(key);
            }),
          );
        }),
      )
    )
      .flat()
      .sort(this.getLocaleSortingFunction());

    this.logService.measure(decryptStartTime, "Vault", "CipherService", "decrypt complete", [
      ["Items", ciphers.length],
    ]);

    // Split ciphers into two arrays, one for successfully decrypted ciphers and one for ciphers that failed to decrypt
    return allCipherViews.reduce(
      (acc, c) => {
        if (c.decryptionFailure) {
          acc[1].push(c);
        } else {
          acc[0].push(c);
        }
        return acc;
      },
      [[], []] as [CipherView[], CipherView[]],
    );
  }

  /**
   * Decrypts a cipher using either the SDK or the legacy method based on the feature flag.
   * @param cipher The cipher to decrypt.
   * @param userId The user ID to use for decryption.
   * @returns A promise that resolves to the decrypted cipher view.
   */
  async decrypt(cipher: Cipher, userId: UserId): Promise<CipherView> {
    if (await this.configService.getFeatureFlag(FeatureFlag.PM19941MigrateCipherDomainToSdk)) {
      return await this.cipherEncryptionService.decrypt(cipher, userId);
    } else {
      const encKey = await this.getKeyForCipherKeyDecryption(cipher, userId);
      return await cipher.decrypt(encKey);
    }
  }

  private async reindexCiphers(userId: UserId) {
    const reindexRequired =
      this.searchService != null &&
      ((await firstValueFrom(this.searchService.indexedEntityId$(userId))) ?? userId) !== userId;
    if (reindexRequired) {
      await this.searchService.indexCiphers(userId, await this.getDecryptedCiphers(userId), userId);
    }
  }

  async getAllDecryptedForGrouping(
    groupingId: string,
    userId: UserId,
    folder = true,
  ): Promise<CipherView[]> {
    const ciphers = await this.getAllDecrypted(userId);

    return ciphers.filter((cipher) => {
      if (cipher.isDeleted) {
        return false;
      }
      if (folder && cipher.folderId === groupingId) {
        return true;
      } else if (
        !folder &&
        cipher.collectionIds != null &&
        cipher.collectionIds.indexOf(groupingId) > -1
      ) {
        return true;
      }

      return false;
    });
  }

  async getAllDecryptedForUrl(
    url: string,
    userId: UserId,
    includeOtherTypes?: CipherType[],
    defaultMatch: UriMatchStrategySetting = null,
    overrideNeverMatchStrategy?: true,
  ): Promise<CipherView[]> {
    return await firstValueFrom(
      this.cipherViews$(userId).pipe(
        filter((c) => c != null),
        switchMap(
          async (ciphers) =>
            await this.filterCiphersForUrl<CipherView>(
              ciphers,
              url,
              includeOtherTypes,
              defaultMatch,
              overrideNeverMatchStrategy,
            ),
        ),
      ),
    );
  }

  async filterCiphersForUrl<C extends CipherViewLike>(
    ciphers: C[],
    url: string,
    includeOtherTypes?: CipherType[],
    defaultMatch: UriMatchStrategySetting = null,
    overrideNeverMatchStrategy?: true,
  ): Promise<C[]> {
    if (url == null && includeOtherTypes == null) {
      return [];
    }

    const equivalentDomains = await firstValueFrom(
      this.domainSettingsService.getUrlEquivalentDomains(url),
    );
    defaultMatch ??= await firstValueFrom(
      this.domainSettingsService.resolvedDefaultUriMatchStrategy$,
    );

    const archiveFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM19148_InnovationArchive,
    );

    return ciphers.filter((cipher) => {
      const type = CipherViewLikeUtils.getType(cipher);
      const login = CipherViewLikeUtils.getLogin(cipher);
      const cipherIsLogin = login !== null;

      if (CipherViewLikeUtils.isDeleted(cipher)) {
        return false;
      }

      if (archiveFeatureEnabled && CipherViewLikeUtils.isArchived(cipher)) {
        return false;
      }

      if (Array.isArray(includeOtherTypes) && includeOtherTypes.includes(type) && !cipherIsLogin) {
        return true;
      }

      if (cipherIsLogin) {
        return CipherViewLikeUtils.matchesUri(
          cipher,
          url,
          equivalentDomains,
          defaultMatch,
          overrideNeverMatchStrategy,
        );
      }

      return false;
    });
  }

  private async getAllDecryptedCiphersOfType(
    type: CipherType[],
    userId: UserId,
  ): Promise<CipherView[]> {
    const ciphers = await this.getAllDecrypted(userId);
    const archiveFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM19148_InnovationArchive,
    );
    return ciphers
      .filter(
        (cipher) =>
          cipher.deletedDate == null &&
          (!archiveFeatureEnabled || !cipher.isArchived) &&
          type.includes(cipher.type),
      )
      .sort((a, b) => this.sortCiphersByLastUsedThenName(a, b));
  }

  async getAllFromApiForOrganization(
    organizationId: string,
    includeMemberItems?: boolean,
  ): Promise<CipherView[]> {
    const response = await this.apiService.getCiphersOrganization(
      organizationId,
      includeMemberItems,
    );
    return await this.decryptOrganizationCiphersResponse(response, organizationId);
  }

  async getManyFromApiForOrganization(organizationId: string): Promise<CipherView[]> {
    const r = await this.apiService.send(
      "GET",
      "/ciphers/organization-details/assigned?organizationId=" + organizationId,
      null,
      true,
      true,
    );
    const response = new ListResponse(r, CipherResponse);
    return this.decryptOrganizationCiphersResponse(response, organizationId);
  }

  private async decryptOrganizationCiphersResponse(
    response: ListResponse<CipherResponse>,
    organizationId: string,
  ): Promise<CipherView[]> {
    if (response?.data == null || response.data.length < 1) {
      return [];
    }

    const ciphers = response.data.map((cr) => new Cipher(new CipherData(cr)));
    const key = await this.keyService.getOrgKey(organizationId);
    const decCiphers: CipherView[] = await Promise.all(
      ciphers.map(async (cipher) => {
        return await cipher.decrypt(key);
      }),
    );

    decCiphers.sort(this.getLocaleSortingFunction());
    return decCiphers;
  }

  async getLastUsedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad = false,
  ): Promise<CipherView> {
    return this.getCipherForUrl(url, userId, true, false, autofillOnPageLoad);
  }

  async getLastLaunchedForUrl(
    url: string,
    userId: UserId,
    autofillOnPageLoad = false,
  ): Promise<CipherView> {
    return this.getCipherForUrl(url, userId, false, true, autofillOnPageLoad);
  }

  async getNextCipherForUrl(url: string, userId: UserId): Promise<CipherView> {
    return this.getCipherForUrl(url, userId, false, false, false);
  }

  async getNextCardCipher(userId: UserId): Promise<CipherView> {
    const cacheKey = "cardCiphers";

    if (!this.sortedCiphersCache.isCached(cacheKey)) {
      const ciphers = await this.getAllDecryptedCiphersOfType([CipherType.Card], userId);
      if (!ciphers?.length) {
        return null;
      }

      this.sortedCiphersCache.addCiphers(cacheKey, ciphers);
    }

    return this.sortedCiphersCache.getNext(cacheKey);
  }

  async getNextIdentityCipher(userId: UserId): Promise<CipherView> {
    const cacheKey = "identityCiphers";

    if (!this.sortedCiphersCache.isCached(cacheKey)) {
      const ciphers = await this.getAllDecryptedCiphersOfType([CipherType.Identity], userId);
      if (!ciphers?.length) {
        return null;
      }

      this.sortedCiphersCache.addCiphers(cacheKey, ciphers);
    }

    return this.sortedCiphersCache.getNext(cacheKey);
  }

  updateLastUsedIndexForUrl(url: string) {
    this.sortedCiphersCache.updateLastUsedIndex(url);
  }

  async updateLastUsedDate(id: string, userId: UserId): Promise<void> {
    let ciphersLocalData = await firstValueFrom(this.localData$(userId));

    if (!ciphersLocalData) {
      ciphersLocalData = {};
    }

    const cipherId = id as CipherId;
    if (ciphersLocalData[cipherId]) {
      ciphersLocalData[cipherId].lastUsedDate = new Date().getTime();
    } else {
      ciphersLocalData[cipherId] = { lastUsedDate: new Date().getTime() };
    }

    await this.localDataState(userId).update(() => ciphersLocalData);

    const decryptedCipherCache = await this.getDecryptedCiphers(userId);
    if (!decryptedCipherCache) {
      return;
    }

    for (let i = 0; i < decryptedCipherCache.length; i++) {
      const cached = decryptedCipherCache[i];
      if (cached.id === id) {
        cached.localData = ciphersLocalData[id as CipherId];
        break;
      }
    }
    await this.setDecryptedCiphers(decryptedCipherCache, userId);
  }

  async updateLastLaunchedDate(id: string, userId: UserId): Promise<void> {
    let ciphersLocalData = await firstValueFrom(this.localData$(userId));

    if (!ciphersLocalData) {
      ciphersLocalData = {};
    }

    const currentTime = new Date().getTime();
    ciphersLocalData[id as CipherId] = { lastLaunched: currentTime, lastUsedDate: currentTime };

    await this.localDataState(userId).update(() => ciphersLocalData);

    const decryptedCipherCache = await this.getDecryptedCiphers(userId);
    if (!decryptedCipherCache) {
      return;
    }

    for (let i = 0; i < decryptedCipherCache.length; i++) {
      const cached = decryptedCipherCache[i];
      if (cached.id === id) {
        cached.localData = ciphersLocalData[id as CipherId];
        break;
      }
    }
    await this.setDecryptedCiphers(decryptedCipherCache, userId);
  }

  async saveNeverDomain(domain: string): Promise<void> {
    if (domain == null) {
      return;
    }

    let domains = await firstValueFrom(this.domainSettingsService.neverDomains$);
    if (!domains) {
      domains = {};
    }
    domains[domain] = null;
    await this.domainSettingsService.setNeverDomains(domains);
  }

  async createWithServer(
    { cipher, encryptedFor }: EncryptionContext,
    orgAdmin?: boolean,
  ): Promise<Cipher> {
    let response: CipherResponse;
    if (orgAdmin && cipher.organizationId != null) {
      const request = new CipherCreateRequest({ cipher, encryptedFor });
      response = await this.apiService.postCipherAdmin(request);
      const data = new CipherData(response, cipher.collectionIds);
      return new Cipher(data);
    } else if (cipher.collectionIds != null && cipher.collectionIds.length > 0) {
      const request = new CipherCreateRequest({ cipher, encryptedFor });
      response = await this.apiService.postCipherCreate(request);
    } else {
      const request = new CipherRequest({ cipher, encryptedFor });
      response = await this.apiService.postCipher(request);
    }

    cipher.id = response.id;

    const data = new CipherData(response, cipher.collectionIds);
    const updated = await this.upsert(data);
    // No local data for new ciphers
    return new Cipher(updated[cipher.id as CipherId]);
  }

  async updateWithServer(
    { cipher, encryptedFor }: EncryptionContext,
    orgAdmin?: boolean,
  ): Promise<Cipher> {
    let response: CipherResponse;
    if (orgAdmin) {
      const request = new CipherRequest({ cipher, encryptedFor });
      response = await this.apiService.putCipherAdmin(cipher.id, request);
      const data = new CipherData(response, cipher.collectionIds);
      return new Cipher(data, cipher.localData);
    } else if (cipher.edit) {
      const request = new CipherRequest({ cipher, encryptedFor });
      response = await this.apiService.putCipher(cipher.id, request);
    } else {
      const request = new CipherPartialRequest(cipher);
      response = await this.apiService.putPartialCipher(cipher.id, request);
    }

    const data = new CipherData(response, cipher.collectionIds);
    const updated = await this.upsert(data);
    // updating with server does not change local data
    return new Cipher(updated[cipher.id as CipherId], cipher.localData);
  }

  async shareWithServer(
    cipher: CipherView,
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
    originalCipher?: Cipher,
  ): Promise<Cipher> {
    const sdkCipherEncryptionEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM22136_SdkCipherEncryption,
    );

    await this.adjustCipherHistory(cipher, userId, originalCipher);

    let encCipher: EncryptionContext;
    if (sdkCipherEncryptionEnabled) {
      // The SDK does not expect the cipher to already have an organizationId. It will result in the wrong
      // cipher encryption key being used during the move to organization operation.
      if (cipher.organizationId != null) {
        throw new Error("Cipher is already associated with an organization.");
      }

      encCipher = await this.cipherEncryptionService.moveToOrganization(
        cipher,
        organizationId as OrganizationId,
        userId,
      );
      encCipher.cipher.collectionIds = collectionIds;
    } else {
      // This old attachment logic is safe to remove after it is replaced in PM-22750; which will require fixing
      // the attachment before sharing.
      const attachmentPromises: Promise<any>[] = [];
      if (cipher.attachments != null) {
        cipher.attachments.forEach((attachment) => {
          if (attachment.key == null) {
            attachmentPromises.push(
              this.shareAttachmentWithServer(
                attachment,
                cipher.id,
                organizationId,
                cipher.revisionDate,
              ),
            );
          }
        });
      }
      await Promise.all(attachmentPromises);

      cipher.organizationId = organizationId;
      cipher.collectionIds = collectionIds;
      encCipher = await this.encryptSharedCipher(cipher, userId);
    }

    const request = new CipherShareRequest(encCipher);
    const response = await this.apiService.putShareCipher(cipher.id, request);
    const data = new CipherData(response, collectionIds);
    await this.upsert(data);
    return new Cipher(data, cipher.localData);
  }

  async shareManyWithServer(
    ciphers: CipherView[],
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
  ) {
    const sdkCipherEncryptionEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM22136_SdkCipherEncryption,
    );
    const promises: Promise<any>[] = [];
    const encCiphers: Cipher[] = [];
    for (const cipher of ciphers) {
      if (sdkCipherEncryptionEnabled) {
        // The SDK does not expect the cipher to already have an organizationId. It will result in the wrong
        // cipher encryption key being used during the move to organization operation.
        if (cipher.organizationId != null) {
          throw new Error("Cipher is already associated with an organization.");
        }

        promises.push(
          this.cipherEncryptionService
            .moveToOrganization(cipher, organizationId as OrganizationId, userId)
            .then((encCipher) => {
              encCipher.cipher.collectionIds = collectionIds;
              encCiphers.push(encCipher.cipher);
            }),
        );
      } else {
        cipher.organizationId = organizationId;
        cipher.collectionIds = collectionIds;
        promises.push(
          this.encryptSharedCipher(cipher, userId).then((c) => {
            encCiphers.push(c.cipher);
          }),
        );
      }
    }
    await Promise.all(promises);
    const request = new CipherBulkShareRequest(encCiphers, collectionIds, userId);
    try {
      const response = await this.apiService.putShareCiphers(request);
      const responseMap = new Map(response.data.map((r) => [r.id, r]));

      encCiphers.forEach((cipher) => {
        const matchingCipher = responseMap.get(cipher.id);
        if (matchingCipher) {
          cipher.revisionDate = new Date(matchingCipher.revisionDate);
        }
      });
      await this.upsert(encCiphers.map((c) => c.toCipherData()));
    } catch (e) {
      for (const cipher of ciphers) {
        cipher.organizationId = null;
        cipher.collectionIds = null;
      }
      throw e;
    }
  }

  saveAttachmentWithServer(
    cipher: Cipher,
    unencryptedFile: any,
    userId: UserId,
    admin = false,
  ): Promise<Cipher> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(unencryptedFile);
      reader.onload = async (evt: any) => {
        try {
          const cData = await this.saveAttachmentRawWithServer(
            cipher,
            unencryptedFile.name,
            evt.target.result,
            userId,
            admin,
          );
          resolve(cData);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => {
        reject("Error reading file.");
      };
    });
  }

  async saveAttachmentRawWithServer(
    cipher: Cipher,
    filename: string,
    data: Uint8Array,
    userId: UserId,
    admin = false,
  ): Promise<Cipher> {
    const encKey = await this.getKeyForCipherKeyDecryption(cipher, userId);
    const cipherKeyEncryptionEnabled = await this.getCipherKeyEncryptionEnabled();

    const cipherEncKey =
      cipherKeyEncryptionEnabled && cipher.key != null
        ? ((await this.encryptService.unwrapSymmetricKey(cipher.key, encKey)) as UserKey)
        : encKey;

    //if cipher key encryption is disabled but the item has an individual key,
    //then we rollback to using the user key as the main key of encryption of the item
    //in order to keep item and it's attachments with the same encryption level
    if (cipher.key != null && !cipherKeyEncryptionEnabled) {
      const model = await this.decrypt(cipher, userId);
      const reEncrypted = await this.encrypt(model, userId);
      await this.updateWithServer(reEncrypted);
    }

    const encFileName = await this.encryptService.encryptString(filename, cipherEncKey);

    const dataEncKey = await this.keyService.makeDataEncKey(cipherEncKey);
    const encData = await this.encryptService.encryptFileData(new Uint8Array(data), dataEncKey[0]);

    const response = await this.cipherFileUploadService.upload(
      cipher,
      encFileName,
      encData,
      admin,
      dataEncKey,
    );

    const cData = new CipherData(response, cipher.collectionIds);
    if (!admin) {
      await this.upsert(cData);
    }
    return new Cipher(cData);
  }

  async saveCollectionsWithServer(cipher: Cipher, userId: UserId): Promise<Cipher> {
    const request = new CipherCollectionsRequest(cipher.collectionIds);
    const response = await this.apiService.putCipherCollections(cipher.id, request);
    // The response will now check for an unavailable value. This value determines whether
    // the user still has Can Manage access to the item after updating.
    if (response.unavailable) {
      await this.delete(cipher.id, userId);
      return;
    }
    const data = new CipherData(response.cipher);
    const updated = await this.upsert(data);
    return new Cipher(updated[cipher.id as CipherId], cipher.localData);
  }

  async saveCollectionsWithServerAdmin(cipher: Cipher): Promise<Cipher> {
    const request = new CipherCollectionsRequest(cipher.collectionIds);
    const response = await this.apiService.putCipherCollectionsAdmin(cipher.id, request);
    // The response will be incomplete with several properties missing values
    // We will assign those properties values so the SDK decryption can complete
    const completedResponse = new CipherResponse(response);
    completedResponse.edit = true;
    completedResponse.viewPassword = true;
    completedResponse.favorite = false;
    const data = new CipherData(completedResponse);
    return new Cipher(data);
  }

  /**
   * Bulk update collections for many ciphers with the server
   * @param orgId
   * @param cipherIds
   * @param collectionIds
   * @param removeCollections - If true, the collectionIds will be removed from the ciphers, otherwise they will be added
   */
  async bulkUpdateCollectionsWithServer(
    orgId: OrganizationId,
    userId: UserId,
    cipherIds: CipherId[],
    collectionIds: CollectionId[],
    removeCollections: boolean = false,
  ): Promise<void> {
    const request = new CipherBulkUpdateCollectionsRequest(
      orgId,
      cipherIds,
      collectionIds,
      removeCollections,
    );

    await this.apiService.send("POST", "/ciphers/bulk-collections", request, true, false);

    // Update the local state
    const ciphers = await firstValueFrom(this.ciphers$(userId));

    for (const id of cipherIds) {
      const cipher = ciphers[id];
      if (cipher) {
        if (removeCollections) {
          cipher.collectionIds = cipher.collectionIds?.filter(
            (cid) => !collectionIds.includes(cid as CollectionId),
          );
        } else {
          // Append to the collectionIds if it's not already there
          cipher.collectionIds = [...new Set([...(cipher.collectionIds ?? []), ...collectionIds])];
        }
      }
    }

    await this.clearCache();
    await this.encryptedCiphersState(userId).update(() => ciphers);
  }

  async upsert(cipher: CipherData | CipherData[]): Promise<Record<CipherId, CipherData>> {
    const ciphers = cipher instanceof CipherData ? [cipher] : cipher;
    const res = await this.updateEncryptedCipherState((current) => {
      ciphers.forEach((c) => (current[c.id as CipherId] = c));
      return current;
    });
    // Some state storage providers (e.g. Electron) don't update the state immediately, wait for next tick
    // Otherwise, subscribers to cipherViews$ can get stale data
    await new Promise((resolve) => setTimeout(resolve, 0));
    return res;
  }

  async replace(ciphers: { [id: string]: CipherData }, userId: UserId): Promise<any> {
    const current = (await firstValueFrom(this.encryptedCiphersState(userId).state$)) ?? {};

    // The extension relies on chrome.storage.StorageArea.onChanged to detect updates.
    // If stored and provided data are identical, this event doesn’t fire and the ciphers$
    // observable won’t emit a new value. In this case we can skip the update to avoid calling
    // clearCache and causing an empty state.
    // If the current state is empty (eg. for new users), we still want to perform the update to ensure
    // we trigger an emission as many subscribers rely on it during initialization.
    if (Object.keys(current).length > 0 && JSON.stringify(current) === JSON.stringify(ciphers)) {
      return;
    }

    await this.updateEncryptedCipherState(() => ciphers, userId);
  }

  /**
   * Updates ciphers for the currently active user. Inactive users can only clear all ciphers, for now.
   * @param update update callback for encrypted cipher data
   * @returns
   */
  private async updateEncryptedCipherState(
    update: (current: Record<CipherId, CipherData>) => Record<CipherId, CipherData>,
    userId: UserId = null,
  ): Promise<Record<CipherId, CipherData>> {
    userId ||= await firstValueFrom(this.stateProvider.activeUserId$);

    await this.clearCache(userId);

    const updatedCiphers = await this.stateProvider
      .getUser(userId, ENCRYPTED_CIPHERS)
      .update((current) => {
        const result = update(current ?? {});
        return result;
      });

    // Some state storage providers (e.g. Electron) don't update the state immediately, wait for next tick
    // Otherwise, subscribers to cipherViews$ can get stale data
    await new Promise((resolve) => setTimeout(resolve, 0));
    return updatedCiphers;
  }

  async clear(userId?: UserId): Promise<void> {
    userId ??= await firstValueFrom(this.stateProvider.activeUserId$);
    await this.clearEncryptedCiphersState(userId);
    await this.clearCache(userId);
  }

  async moveManyWithServer(ids: string[], folderId: string, userId: UserId): Promise<any> {
    await this.apiService.putMoveCiphers(new CipherBulkMoveRequest(ids, folderId));

    let ciphers = await firstValueFrom(this.ciphers$(userId));
    if (ciphers == null) {
      ciphers = {};
    }

    ids.forEach((id) => {
      // eslint-disable-next-line
      if (ciphers.hasOwnProperty(id)) {
        ciphers[id as CipherId].folderId = folderId;
      }
    });

    await this.clearCache();
    await this.encryptedCiphersState(userId).update(() => ciphers);
  }

  async delete(id: string | string[], userId: UserId): Promise<any> {
    const ciphers = await firstValueFrom(this.ciphers$(userId));
    if (ciphers == null) {
      return;
    }

    if (typeof id === "string") {
      const cipherId = id as CipherId;
      if (ciphers[cipherId] == null) {
        return;
      }
      delete ciphers[cipherId];
    } else {
      (id as CipherId[]).forEach((i) => {
        delete ciphers[i];
      });
    }

    await this.clearCache();
    await this.encryptedCiphersState(userId).update(() => ciphers);
  }

  async deleteWithServer(id: string, userId: UserId, asAdmin = false): Promise<any> {
    if (asAdmin) {
      await this.apiService.deleteCipherAdmin(id);
    } else {
      await this.apiService.deleteCipher(id);
    }

    await this.delete(id, userId);
  }

  async deleteManyWithServer(ids: string[], userId: UserId, asAdmin = false): Promise<any> {
    const request = new CipherBulkDeleteRequest(ids);
    if (asAdmin) {
      await this.apiService.deleteManyCiphersAdmin(request);
    } else {
      await this.apiService.deleteManyCiphers(request);
    }
    await this.delete(ids, userId);
  }

  async deleteAttachment(
    id: string,
    revisionDate: string,
    attachmentId: string,
    userId: UserId,
  ): Promise<CipherData> {
    let ciphers = await firstValueFrom(this.ciphers$(userId));
    const cipherId = id as CipherId;
    // eslint-disable-next-line
    if (ciphers == null || !ciphers.hasOwnProperty(id) || ciphers[cipherId].attachments == null) {
      return;
    }

    for (let i = 0; i < ciphers[cipherId].attachments.length; i++) {
      if (ciphers[cipherId].attachments[i].id === attachmentId) {
        ciphers[cipherId].attachments.splice(i, 1);
      }
    }

    // Deleting the cipher updates the revision date on the server,
    // Update the stored `revisionDate` to match
    ciphers[cipherId].revisionDate = revisionDate;

    await this.clearCache();
    await this.encryptedCiphersState(userId).update(() => {
      if (ciphers == null) {
        ciphers = {};
      }
      return ciphers;
    });

    return ciphers[cipherId];
  }

  async deleteAttachmentWithServer(
    id: string,
    attachmentId: string,
    userId: UserId,
    admin: boolean = false,
  ): Promise<CipherData> {
    let cipherResponse = null;
    try {
      cipherResponse = admin
        ? await this.apiService.deleteCipherAttachmentAdmin(id, attachmentId)
        : await this.apiService.deleteCipherAttachment(id, attachmentId);
    } catch (e) {
      return Promise.reject((e as ErrorResponse).getSingleMessage());
    }

    const cipherData = CipherData.fromJSON(cipherResponse?.cipher);

    return await this.deleteAttachment(id, cipherData.revisionDate, attachmentId, userId);
  }

  sortCiphersByLastUsed(a: CipherViewLike, b: CipherViewLike): number {
    const aLastUsed =
      a.localData && a.localData.lastUsedDate ? (a.localData.lastUsedDate as number) : null;
    const bLastUsed =
      b.localData && b.localData.lastUsedDate ? (b.localData.lastUsedDate as number) : null;

    const bothNotNull = aLastUsed != null && bLastUsed != null;
    if (bothNotNull && aLastUsed < bLastUsed) {
      return 1;
    }
    if (aLastUsed != null && bLastUsed == null) {
      return -1;
    }

    if (bothNotNull && aLastUsed > bLastUsed) {
      return -1;
    }
    if (bLastUsed != null && aLastUsed == null) {
      return 1;
    }

    return 0;
  }

  sortCiphersByLastUsedThenName(a: CipherViewLike, b: CipherViewLike): number {
    const result = this.sortCiphersByLastUsed(a, b);
    if (result !== 0) {
      return result;
    }

    return this.getLocaleSortingFunction()(a, b);
  }

  getLocaleSortingFunction(): (a: CipherViewLike, b: CipherViewLike) => number {
    return (a, b) => {
      let aName = a.name;
      let bName = b.name;

      if (aName == null && bName != null) {
        return -1;
      }
      if (aName != null && bName == null) {
        return 1;
      }
      if (aName == null && bName == null) {
        return 0;
      }

      const result = this.i18nService.collator
        ? this.i18nService.collator.compare(aName, bName)
        : aName.localeCompare(bName);

      const aType = CipherViewLikeUtils.getType(a);
      const bType = CipherViewLikeUtils.getType(b);

      if (result !== 0 || aType !== CipherType.Login || bType !== CipherType.Login) {
        return result;
      }

      const aLogin = CipherViewLikeUtils.getLogin(a);
      const bLogin = CipherViewLikeUtils.getLogin(b);

      if (aLogin.username != null) {
        aName += aLogin.username;
      }

      if (bLogin.username != null) {
        bName += bLogin.username;
      }

      return this.i18nService.collator
        ? this.i18nService.collator.compare(aName, bName)
        : aName.localeCompare(bName);
    };
  }

  async softDelete(id: string | string[], userId: UserId): Promise<any> {
    let ciphers = await firstValueFrom(this.ciphers$(userId));
    if (ciphers == null) {
      return;
    }

    const setDeletedDate = (cipherId: CipherId) => {
      if (ciphers[cipherId] == null) {
        return;
      }
      ciphers[cipherId].deletedDate = new Date().toISOString();
      ciphers[cipherId].archivedDate = null;
    };

    if (typeof id === "string") {
      setDeletedDate(id as CipherId);
    } else {
      (id as string[]).forEach(setDeletedDate);
    }

    await this.clearCache();
    await this.encryptedCiphersState(userId).update(() => {
      if (ciphers == null) {
        ciphers = {};
      }
      return ciphers;
    });
  }

  async softDeleteWithServer(id: string, userId: UserId, asAdmin = false): Promise<any> {
    if (asAdmin) {
      await this.apiService.putDeleteCipherAdmin(id);
    } else {
      await this.apiService.putDeleteCipher(id);
    }

    await this.softDelete(id, userId);
  }

  async softDeleteManyWithServer(ids: string[], userId: UserId, asAdmin = false): Promise<any> {
    const request = new CipherBulkDeleteRequest(ids);
    if (asAdmin) {
      await this.apiService.putDeleteManyCiphersAdmin(request);
    } else {
      await this.apiService.putDeleteManyCiphers(request);
    }

    await this.softDelete(ids, userId);
  }

  async restore(
    cipher: { id: string; revisionDate: string } | { id: string; revisionDate: string }[],
    userId: UserId,
  ) {
    let ciphers = await firstValueFrom(this.ciphers$(userId));
    if (ciphers == null) {
      return;
    }

    const clearDeletedDate = (c: { id: string; revisionDate: string }) => {
      const cipherId = c.id as CipherId;
      if (ciphers[cipherId] == null) {
        return;
      }
      ciphers[cipherId].deletedDate = null;
      ciphers[cipherId].revisionDate = c.revisionDate;
    };

    if (cipher.constructor.name === Array.name) {
      (cipher as { id: string; revisionDate: string }[]).forEach(clearDeletedDate);
    } else {
      clearDeletedDate(cipher as { id: string; revisionDate: string });
    }

    await this.clearCache();
    await this.encryptedCiphersState(userId).update(() => {
      if (ciphers == null) {
        ciphers = {};
      }
      return ciphers;
    });
  }

  async restoreWithServer(id: string, userId: UserId, asAdmin = false): Promise<any> {
    let response;
    if (asAdmin) {
      response = await this.apiService.putRestoreCipherAdmin(id);
    } else {
      response = await this.apiService.putRestoreCipher(id);
    }

    await this.restore({ id: id, revisionDate: response.revisionDate }, userId);
  }

  /**
   * No longer using an asAdmin Param. Org Vault bulkRestore will assess if an item is unassigned or editable
   * The Org Vault will pass those ids an array as well as the orgId when calling bulkRestore
   */
  async restoreManyWithServer(ids: string[], userId: UserId, orgId?: string): Promise<void> {
    let response;

    if (orgId) {
      const request = new CipherBulkRestoreRequest(ids, orgId);
      response = await this.apiService.putRestoreManyCiphersAdmin(request);
    } else {
      const request = new CipherBulkRestoreRequest(ids);
      response = await this.apiService.putRestoreManyCiphers(request);
    }

    const restores: { id: string; revisionDate: string }[] = [];
    for (const cipher of response.data) {
      restores.push({ id: cipher.id, revisionDate: cipher.revisionDate });
    }
    await this.restore(restores, userId);
  }

  async getKeyForCipherKeyDecryption(cipher: Cipher, userId: UserId): Promise<UserKey | OrgKey> {
    return (
      (await this.keyService.getOrgKey(cipher.organizationId)) ||
      ((await this.keyService.getUserKey(userId)) as UserKey)
    );
  }

  async setAddEditCipherInfo(value: AddEditCipherInfo, userId: UserId) {
    await this.addEditCipherInfoState(userId).update(() => value, {
      shouldUpdate: (current) => !(current == null && value == null),
    });
  }

  async getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<CipherWithIdRequest[]> {
    if (originalUserKey == null) {
      throw new Error("Original user key is required to rotate ciphers");
    }
    if (newUserKey == null) {
      throw new Error("New user key is required to rotate ciphers");
    }

    let encryptedCiphers: CipherWithIdRequest[] = [];

    const ciphers = await firstValueFrom(this.cipherViews$(userId));
    const failedCiphers = await firstValueFrom(this.failedToDecryptCiphers$(userId));
    if (!ciphers) {
      return encryptedCiphers;
    }

    if (failedCiphers.length > 0) {
      throw new Error("Cannot rotate ciphers when decryption failures are present");
    }

    const userCiphers = ciphers.filter((c) => c.organizationId == null);
    if (userCiphers.length === 0) {
      return encryptedCiphers;
    }

    const useSdkEncryption = await this.configService.getFeatureFlag(
      FeatureFlag.PM22136_SdkCipherEncryption,
    );

    encryptedCiphers = await Promise.all(
      userCiphers.map(async (cipher) => {
        const encryptedCipher = useSdkEncryption
          ? await this.cipherEncryptionService.encryptCipherForRotation(cipher, userId, newUserKey)
          : await this.encrypt(cipher, userId, newUserKey, originalUserKey);
        return new CipherWithIdRequest(encryptedCipher);
      }),
    );

    return encryptedCiphers;
  }

  /** @inheritdoc */
  async getDecryptedAttachmentBuffer(
    cipherId: CipherId,
    attachment: AttachmentView,
    response: Response,
    userId: UserId,
    useLegacyDecryption?: boolean,
  ): Promise<Uint8Array> {
    const useSdkDecryption = await this.configService.getFeatureFlag(
      FeatureFlag.PM19941MigrateCipherDomainToSdk,
    );

    const cipherDomain = await firstValueFrom(
      this.ciphers$(userId).pipe(map((ciphersData) => new Cipher(ciphersData[cipherId]))),
    );

    if (useSdkDecryption && !useLegacyDecryption) {
      const encryptedContent = await response.arrayBuffer();
      return this.cipherEncryptionService.decryptAttachmentContent(
        cipherDomain,
        attachment,
        new Uint8Array(encryptedContent),
        userId,
      );
    }

    const encBuf = await EncArrayBuffer.fromResponse(response);
    const key =
      attachment.key != null
        ? attachment.key
        : await firstValueFrom(
            this.keyService.orgKeys$(userId).pipe(
              filterOutNullish(),
              map((orgKeys) => orgKeys[cipherDomain.organizationId as OrganizationId] as OrgKey),
            ),
          );
    return await this.encryptService.decryptFileData(encBuf, key);
  }

  /**
   * @returns a SingleUserState
   */
  private localDataState(userId: UserId) {
    return this.stateProvider.getUser(userId, LOCAL_DATA_KEY);
  }

  /**
   * @returns a SingleUserState for the encrypted ciphers
   */
  private encryptedCiphersState(userId: UserId) {
    return this.stateProvider.getUser(userId, ENCRYPTED_CIPHERS);
  }

  /**
   * @returns a SingleUserState for the decrypted ciphers
   */
  private decryptedCiphersState(userId: UserId) {
    return this.stateProvider.getUser(userId, DECRYPTED_CIPHERS);
  }

  /**
   * @returns a SingleUserState for the add/edit cipher info
   */
  private addEditCipherInfoState(userId: UserId) {
    return this.stateProvider.getUser(userId, ADD_EDIT_CIPHER_INFO_KEY);
  }

  /**
   * @returns a SingleUserState for the failed to decrypt ciphers
   */
  private failedToDecryptCiphersState(userId: UserId) {
    return this.stateProvider.getUser(userId, FAILED_DECRYPTED_CIPHERS);
  }

  // Helpers

  // In the case of a cipher that is being shared with an organization, we want to decrypt the
  // cipher key with the user's key and then re-encrypt it with the organization's key.
  private async encryptSharedCipher(model: CipherView, userId: UserId): Promise<EncryptionContext> {
    const keyForCipherKeyDecryption = await this.keyService.getUserKey(userId);
    return await this.encrypt(model, userId, null, keyForCipherKeyDecryption);
  }

  private async updateModelfromExistingCipher(
    model: CipherView,
    originalCipher: Cipher,
    userId: UserId,
  ): Promise<void> {
    const existingCipher = await this.decrypt(originalCipher, userId);
    model.passwordHistory = existingCipher.passwordHistory || [];
    if (model.type === CipherType.Login && existingCipher.type === CipherType.Login) {
      if (
        existingCipher.login.password != null &&
        existingCipher.login.password !== "" &&
        existingCipher.login.password !== model.login.password
      ) {
        const ph = new PasswordHistoryView();
        ph.password = existingCipher.login.password;
        ph.lastUsedDate = model.login.passwordRevisionDate = new Date();
        model.passwordHistory.splice(0, 0, ph);
      } else {
        model.login.passwordRevisionDate = existingCipher.login.passwordRevisionDate;
      }
    }
    if (existingCipher.hasFields) {
      const existingHiddenFields = existingCipher.fields.filter(
        (f) =>
          f.type === FieldType.Hidden &&
          f.name != null &&
          f.name !== "" &&
          f.value != null &&
          f.value !== "",
      );
      const hiddenFields =
        model.fields == null
          ? []
          : model.fields.filter(
              (f) => f.type === FieldType.Hidden && f.name != null && f.name !== "",
            );
      existingHiddenFields.forEach((ef) => {
        const matchedField = hiddenFields.find((f) => f.name === ef.name);
        if (matchedField == null || matchedField.value !== ef.value) {
          const ph = new PasswordHistoryView();
          ph.password = ef.name + ": " + ef.value;
          ph.lastUsedDate = new Date();
          model.passwordHistory.splice(0, 0, ph);
        }
      });
    }
  }

  private adjustPasswordHistoryLength(model: CipherView) {
    if (model.passwordHistory != null && model.passwordHistory.length === 0) {
      model.passwordHistory = null;
    } else if (model.passwordHistory != null && model.passwordHistory.length > 5) {
      // only save last 5 history
      model.passwordHistory = model.passwordHistory.slice(0, 5);
    }
  }

  private async shareAttachmentWithServer(
    attachmentView: AttachmentView,
    cipherId: string,
    organizationId: string,
    lastKnownRevisionDate: Date,
  ): Promise<any> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$);

    const attachmentResponse = await this.apiService.nativeFetch(
      new Request(attachmentView.url, { cache: "no-store" }),
    );
    if (attachmentResponse.status !== 200) {
      throw Error("Failed to download attachment: " + attachmentResponse.status.toString());
    }

    const encBuf = await EncArrayBuffer.fromResponse(attachmentResponse);
    const userKey = await this.keyService.getUserKey(activeUserId.id);
    const decBuf = await this.encryptService.decryptFileData(encBuf, userKey);

    let encKey: UserKey | OrgKey;
    encKey = await this.keyService.getOrgKey(organizationId);
    encKey ||= (await this.keyService.getUserKey()) as UserKey;

    const dataEncKey = await this.keyService.makeDataEncKey(encKey);

    const encFileName = await this.encryptService.encryptString(attachmentView.fileName, encKey);
    const encData = await this.encryptService.encryptFileData(
      new Uint8Array(decBuf),
      dataEncKey[0],
    );

    const fd = new FormData();
    try {
      const blob = new Blob([encData.buffer], { type: "application/octet-stream" });
      fd.append("key", dataEncKey[1].encryptedString);
      fd.append("data", blob, encFileName.encryptedString);
      fd.append("lastKnownRevisionDate", lastKnownRevisionDate.toISOString());
    } catch (e) {
      if (Utils.isNode && !Utils.isBrowser) {
        fd.append("key", dataEncKey[1].encryptedString);
        fd.append("lastKnownRevisionDate", lastKnownRevisionDate.toISOString());
        fd.append(
          "data",
          Buffer.from(encData.buffer) as any,
          { filepath: encFileName.encryptedString, contentType: "application/octet-stream" } as any,
        );
      } else {
        throw e;
      }
    }

    try {
      await this.apiService.postShareCipherAttachment(
        cipherId,
        attachmentView.id,
        fd,
        organizationId,
      );
    } catch (e) {
      throw new Error((e as ErrorResponse).getSingleMessage());
    }
  }

  private async encryptObjProperty<V extends View, D extends Domain>(
    model: V,
    obj: D,
    map: any,
    key: SymmetricCryptoKey,
  ): Promise<void> {
    const promises = [];
    const self = this;

    for (const prop in map) {
      // eslint-disable-next-line
      if (!map.hasOwnProperty(prop)) {
        continue;
      }

      (function (theProp, theObj) {
        const p = Promise.resolve()
          .then(() => {
            const modelProp = (model as any)[map[theProp] || theProp];
            if (modelProp && modelProp !== "") {
              return self.encryptService.encryptString(modelProp, key);
            }
            return null;
          })
          .then((val: EncString) => {
            (theObj as any)[theProp] = val;
          });
        promises.push(p);
      })(prop, obj);
    }

    await Promise.all(promises);
  }

  private async encryptCipherData(cipher: Cipher, model: CipherView, key: SymmetricCryptoKey) {
    switch (cipher.type) {
      case CipherType.Login:
        cipher.login = new Login();
        cipher.login.passwordRevisionDate = model.login.passwordRevisionDate;
        cipher.login.autofillOnPageLoad = model.login.autofillOnPageLoad;
        await this.encryptObjProperty(
          model.login,
          cipher.login,
          { username: null, password: null, totp: null },
          key,
        );

        if (model.login.uris != null) {
          cipher.login.uris = [];
          model.login.uris = model.login.uris.filter((u) => u.uri != null && u.uri !== "");
          for (let i = 0; i < model.login.uris.length; i++) {
            const loginUri = new LoginUri();
            loginUri.match = model.login.uris[i].match;
            await this.encryptObjProperty(model.login.uris[i], loginUri, { uri: null }, key);
            const uriHash = await this.encryptService.hash(model.login.uris[i].uri, "sha256");
            loginUri.uriChecksum = await this.encryptService.encryptString(uriHash, key);
            cipher.login.uris.push(loginUri);
          }
        }

        if (model.login.fido2Credentials != null) {
          cipher.login.fido2Credentials = await Promise.all(
            model.login.fido2Credentials.map(async (viewKey) => {
              const domainKey = new Fido2Credential();
              await this.encryptObjProperty(
                viewKey,
                domainKey,
                {
                  credentialId: null,
                  keyType: null,
                  keyAlgorithm: null,
                  keyCurve: null,
                  keyValue: null,
                  rpId: null,
                  rpName: null,
                  userHandle: null,
                  userName: null,
                  userDisplayName: null,
                  origin: null,
                },
                key,
              );
              domainKey.counter = await this.encryptService.encryptString(
                String(viewKey.counter),
                key,
              );
              domainKey.discoverable = await this.encryptService.encryptString(
                String(viewKey.discoverable),
                key,
              );
              domainKey.creationDate = viewKey.creationDate;
              return domainKey;
            }),
          );
        }
        return;
      case CipherType.SecureNote:
        cipher.secureNote = new SecureNote();
        cipher.secureNote.type = model.secureNote.type;
        return;
      case CipherType.Card:
        cipher.card = new Card();
        await this.encryptObjProperty(
          model.card,
          cipher.card,
          {
            cardholderName: null,
            brand: null,
            number: null,
            expMonth: null,
            expYear: null,
            code: null,
          },
          key,
        );
        return;
      case CipherType.Identity:
        cipher.identity = new Identity();
        await this.encryptObjProperty(
          model.identity,
          cipher.identity,
          {
            title: null,
            firstName: null,
            middleName: null,
            lastName: null,
            address1: null,
            address2: null,
            address3: null,
            city: null,
            state: null,
            postalCode: null,
            country: null,
            company: null,
            email: null,
            phone: null,
            ssn: null,
            username: null,
            passportNumber: null,
            licenseNumber: null,
          },
          key,
        );
        return;
      case CipherType.SshKey:
        cipher.sshKey = new SshKey();
        await this.encryptObjProperty(
          model.sshKey,
          cipher.sshKey,
          { privateKey: null, publicKey: null, keyFingerprint: null },
          key,
        );
        return;
      default:
        throw new Error("Unknown cipher type.");
    }
  }

  private async getAutofillOnPageLoadDefault() {
    return await firstValueFrom(this.autofillSettingsService.autofillOnPageLoadDefault$);
  }

  private async getCipherForUrl(
    url: string,
    userId: UserId,
    lastUsed: boolean,
    lastLaunched: boolean,
    autofillOnPageLoad: boolean,
  ): Promise<CipherView> {
    const cacheKey = autofillOnPageLoad ? "autofillOnPageLoad-" + url : url;
    if (!this.sortedCiphersCache.isCached(cacheKey)) {
      let ciphers = await this.getAllDecryptedForUrl(url, userId);

      if (!ciphers?.length) {
        return null;
      }

      const localData = await firstValueFrom(this.localData$(userId));
      if (localData) {
        for (const view of ciphers) {
          const data = localData[view.id as CipherId];
          if (data) {
            view.localData = data;
          }
        }
      }

      if (autofillOnPageLoad) {
        const autofillOnPageLoadDefault = await this.getAutofillOnPageLoadDefault();

        ciphers = ciphers.filter(
          (cipher) =>
            cipher.login.autofillOnPageLoad ||
            (cipher.login.autofillOnPageLoad == null && autofillOnPageLoadDefault !== false),
        );
        if (ciphers.length === 0) {
          return null;
        }
      }

      this.sortedCiphersCache.addCiphers(cacheKey, ciphers);
    }

    if (lastLaunched) {
      return this.sortedCiphersCache.getLastLaunched(cacheKey);
    } else if (lastUsed) {
      return this.sortedCiphersCache.getLastUsed(cacheKey);
    } else {
      return this.sortedCiphersCache.getNext(cacheKey);
    }
  }

  private async clearEncryptedCiphersState(userId: UserId) {
    await this.stateProvider.setUserState(ENCRYPTED_CIPHERS, {}, userId);
  }

  private async clearDecryptedCiphersState(userId: UserId) {
    await this.setDecryptedCiphers(null, userId);
    await this.setFailedDecryptedCiphers(null, userId);
    this.clearSortedCiphers();
  }

  private clearSortedCiphers() {
    this.sortedCiphersCache.clear();
  }

  /**
   * Encrypts a cipher object.
   * @param model The cipher view model.
   * @param cipher The cipher object.
   * @param key The encryption key to encrypt with. This can be the org key, user key or cipher key, but must never be null
   */
  private async encryptCipher(
    model: CipherView,
    cipher: Cipher,
    key: SymmetricCryptoKey,
  ): Promise<Cipher> {
    if (key == null) {
      throw new Error(
        "Key to encrypt cipher must not be null. Use the org key, user key or cipher key.",
      );
    }

    await Promise.all([
      this.encryptObjProperty(model, cipher, { name: null, notes: null }, key),
      this.encryptCipherData(cipher, model, key),
      this.encryptFields(model.fields, key).then((fields) => {
        cipher.fields = fields;
      }),
      this.encryptPasswordHistories(model.passwordHistory, key).then((ph) => {
        cipher.passwordHistory = ph;
      }),
      this.encryptAttachments(model.attachments, key).then((attachments) => {
        cipher.attachments = attachments;
      }),
    ]);
    return cipher;
  }

  private async encryptCipherWithCipherKey(
    model: CipherView,
    cipher: Cipher,
    keyForCipherKeyEncryption: SymmetricCryptoKey,
    keyForCipherKeyDecryption: SymmetricCryptoKey,
  ): Promise<Cipher> {
    // First, we get the key for cipher key encryption, in its decrypted form
    let decryptedCipherKey: SymmetricCryptoKey;
    if (cipher.key == null) {
      decryptedCipherKey = await this.keyService.makeCipherKey();
    } else {
      decryptedCipherKey = await this.encryptService.unwrapSymmetricKey(
        cipher.key,
        keyForCipherKeyDecryption,
      );
    }

    // Then, we have to encrypt the cipher key with the proper key.
    cipher.key = await this.encryptService.wrapSymmetricKey(
      decryptedCipherKey,
      keyForCipherKeyEncryption,
    );

    // Finally, we can encrypt the cipher with the decrypted cipher key.
    return this.encryptCipher(model, cipher, decryptedCipherKey);
  }

  private async getCipherKeyEncryptionEnabled(): Promise<boolean> {
    const featureEnabled = await this.configService.getFeatureFlag(FeatureFlag.CipherKeyEncryption);
    const meetsServerVersion = await firstValueFrom(
      this.configService.checkServerMeetsVersionRequirement$(CIPHER_KEY_ENC_MIN_SERVER_VER),
    );
    return featureEnabled && meetsServerVersion;
  }

  /**
   * Decrypts the provided ciphers using the SDK with full CipherView decryption.
   * @param ciphers The encrypted ciphers to decrypt.
   * @param userId The user ID to use for decryption keys.
   * @param fullDecryption When true, returns full CipherView objects with all fields decrypted.
   * @returns A tuple containing:
   *          - Array of fully decrypted CipherView objects, sorted by locale
   *          - Array of CipherView objects that failed to decrypt (marked with decryptionFailure flag)
   * @private
   */
  private async decryptCiphersWithSdk(
    ciphers: Cipher[],
    userId: UserId,
    fullDecryption: true,
  ): Promise<[CipherView[], CipherView[]]>;
  /**
   * Decrypts the provided ciphers using the SDK with lightweight CipherListView decryption.
   * @param ciphers The encrypted ciphers to decrypt.
   * @param userId The user ID to use for decryption keys.
   * @param fullDecryption When false, returns lightweight CipherListView objects for better performance.
   * @returns A tuple containing:
   *          - Array of lightweight CipherListView objects, sorted by locale
   *          - Array of CipherView objects that failed to decrypt (marked with decryptionFailure flag)
   * @private
   */
  private async decryptCiphersWithSdk(
    ciphers: Cipher[],
    userId: UserId,
    fullDecryption: false,
  ): Promise<[CipherListView[], CipherView[]]>;

  private async decryptCiphersWithSdk(
    ciphers: Cipher[],
    userId: UserId,
    fullDecryption: boolean = true,
  ): Promise<[CipherViewLike[], CipherView[]]> {
    const [decrypted, failures] = await this.cipherEncryptionService.decryptManyWithFailures(
      ciphers,
      userId,
    );

    const decryptedViews = fullDecryption
      ? await Promise.all(decrypted.map((c) => this.getFullCipherView(c)))
      : decrypted;

    const failedViews = failures.map((c) => {
      const cipher_view = new CipherView(c);
      cipher_view.name = "[error: cannot decrypt]";
      cipher_view.decryptionFailure = true;
      return cipher_view;
    });

    return [decryptedViews.sort(this.getLocaleSortingFunction()), failedViews];
  }

  /** Fetches the full `CipherView` when a `CipherListView` is passed. */
  async getFullCipherView(c: CipherViewLike): Promise<CipherView> {
    if (CipherViewLikeUtils.isCipherListView(c)) {
      const activeUserId = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.id)),
      );
      const cipher = await this.get(uuidAsString(c.id!), activeUserId);
      return this.decrypt(cipher, activeUserId);
    }

    return Promise.resolve(c);
  }
}
