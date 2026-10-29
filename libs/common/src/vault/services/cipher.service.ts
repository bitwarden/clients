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

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer, EncryptService, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { Measurement, PerfTrackGroup } from "@bitwarden/logging";
import { CipherListView } from "@bitwarden/sdk-internal";

import { ApiService } from "../../abstractions/api.service";
import { AccountService } from "../../auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "../../autofill/services/autofill-settings.service";
import { DomainSettingsService } from "../../autofill/services/domain-settings.service";
import { UriMatchStrategySetting } from "../../models/domain/domain-service";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { UploadOptions } from "../../platform/abstractions/file-upload/file-upload.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { FileUploadType } from "../../platform/enums";
import { MessageSender } from "../../platform/messaging";
import { StateProvider } from "../../platform/state";
import { CipherId, CollectionId, OrganizationId, UserId } from "../../types/guid";
import { OrgKey, UserKey } from "../../types/key";
import { filterOutNullish, perUserCache$ } from "../../vault/utils/observable-utilities";
import { CipherEncryptionService } from "../abstractions/cipher-encryption.service";
import { CipherSdkService, DecryptAllCiphersResult } from "../abstractions/cipher-sdk.service";
import {
  CipherService as CipherServiceAbstraction,
  EncryptionContext,
  RestrictedCipherWriteError,
} from "../abstractions/cipher.service";
import { CipherFileUploadService } from "../abstractions/file-upload/cipher-file-upload.service";
import { FieldType } from "../enums";
import { CipherType } from "../enums/cipher-type";
import { CipherUpdateRoute } from "../enums/cipher-update-route";
import { CipherData } from "../models/data/cipher.data";
import { LocalData, toSdkLocalData } from "../models/data/local.data";
import { Cipher } from "../models/domain/cipher";
import { SortedCiphersCache } from "../models/domain/sorted-ciphers-cache";
import { CipherWithIdRequest } from "../models/request/cipher-with-id.request";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { PasswordHistoryView } from "../models/view/password-history.view";
import { AddEditCipherInfo } from "../types/add-edit-cipher-info";
import { CipherViewLike, CipherViewLikeUtils } from "../utils/cipher-view-like-utils";
import { hydrateCiphersWithLocalData } from "../utils/hydrate-ciphers-with-local-data";

import {
  ADD_EDIT_CIPHER_INFO_KEY,
  ENCRYPTED_CIPHERS,
  FAILED_DECRYPTED_CIPHERS,
  LOCAL_DATA_KEY,
} from "./key-state/ciphers.state";

const PERF_TRACK_GROUP = PerfTrackGroup.Unlock;
const PERF_TRACK = "Vault Items";

// New cipher operations must go through the SDK (CipherSdkService/CipherEncryptionService), not ApiService/EncryptService.
// See libs/common/src/vault/CONTRIBUTING.md.
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
    private legacyCompatKeyService: LegacyCompatKeyService,
    private domainSettingsService: DomainSettingsService,
    private apiService: ApiService,
    private i18nService: I18nService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private encryptService: EncryptService,
    private cipherFileUploadService: CipherFileUploadService,
    private configService: ConfigService,
    private stateProvider: StateProvider,
    private accountService: AccountService,
    private logService: LogService,
    private cipherEncryptionService: CipherEncryptionService,
    private messageSender: MessageSender,
    private cipherSdkService: CipherSdkService,
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
   * Decrypted views including restricted ciphers, for derived streams to keep or drop.
   * Keep this the only full-view decrypt subscription so decryption, the decrypted-cipher cache
   * and the overlay refresh run once.
   */
  private cipherViewsIncludingRestricted$ = perUserCache$(
    (userId: UserId): Observable<CipherView[] | null> => {
      return combineLatest([
        this.encryptedCiphersState(userId).state$,
        this.localData$(userId),
        this.keyService.cipherDecryptionKeys$(userId),
      ]).pipe(
        filter(([ciphers, _, keys]) => ciphers != null && keys != null), // Skip if ciphers haven't been loaded yor synced yet
        switchMap(() => this.getAllDecryptedIncludingRestricted(userId)),
        tap(() => {
          this.messageSender.send("updateOverlayCiphers");
        }),
      );
    },
    this.clearCipherViewsForUser$,
  );

  /**
   * Observable that emits an array of decrypted ciphers for the active user.
   * This observable will not emit until the encrypted ciphers have either been loaded from state or after sync.
   *
   * A `null` value indicates that the latest encrypted ciphers have not been decrypted yet and that
   * decryption is in progress. The latest decrypted ciphers will be emitted once decryption is complete.
   *
   * Excludes restricted ciphers, so they never reach flows such as autofill, export or key
   * rotation.
   */
  cipherViews$ = perUserCache$((userId: UserId): Observable<CipherView[] | null> => {
    return this.cipherViewsIncludingRestricted$(userId).pipe(
      map((views) => this.excludeRestricted(views)),
    );
  }, this.clearCipherViewsForUser$);

  /**
   * Decrypted list views including restricted ciphers, for the web vault list and its
   * filters; everything else uses {@link cipherListViews$}.
   */
  cipherListViewsIncludingRestricted$ = perUserCache$((userId: UserId) => {
    let decryptMeasurement: Measurement;

    // Decrypts when the ciphers or keys change, not on `localData`, which every autofill
    // writes: it is unencrypted and joined onto the views afterwards.
    const decrypted$ = combineLatest([
      this.encryptedCiphersState(userId).state$,
      this.keyService.cipherDecryptionKeys$(userId, true),
    ]).pipe(
      filter(([cipherDataState, keys]) => cipherDataState != null && keys != null),
      map(([cipherDataState]) =>
        Object.values(cipherDataState).map((cipherData) => new Cipher(cipherData)),
      ),
      tap(() => {
        decryptMeasurement = this.logService.startMeasurement(
          PERF_TRACK_GROUP,
          PERF_TRACK,
          "listViewDecrypt",
        );
      }),
      switchMap(async (ciphers) => {
        return await this.decryptCiphersWithSdk(ciphers, userId);
      }),
      tap(([decrypted, failures]) => {
        void Promise.all([this.setFailedDecryptedCiphers(failures, userId)]);

        decryptMeasurement.finish([["Items", decrypted.length]]);
      }),
      map(([decrypted]) => decrypted),
    );

    return combineLatest([decrypted$, this.localData$(userId)]).pipe(
      map(([views, localData]) => {
        // Copies only views that have local data: the decrypted views stay referenced
        // here too, so copying every view would keep two of each.
        const byId: Record<string, LocalData> = localData;
        return views.map((view) => {
          const viewLocalData = view.id == null ? undefined : byId[uuidAsString(view.id)];
          return viewLocalData == null
            ? view
            : { ...view, localData: toSdkLocalData(viewLocalData) };
        });
      }),
      // The extension's URL matching reads list views, so its inline menu refreshes from here.
      tap(() => this.messageSender.send("updateOverlayCiphers")),
    );
  }, this.clearCipherViewsForUser$);

  /**
   * Observable that emits an array of decrypted ciphers for given userId.
   * This observable will not emit until the encrypted ciphers have either been loaded from state or after sync.
   *
   * This uses the SDK for decryption.
   * Usage of the {@link CipherViewLike} type is recommended to ensure both `CipherView` and `CipherListView` are supported.
   *
   * Excludes restricted ciphers. Derived from {@link cipherListViewsIncludingRestricted$}, so
   * decryption runs once.
   */
  cipherListViews$ = perUserCache$((userId: UserId) => {
    return this.cipherListViewsIncludingRestricted$(userId).pipe(
      map((views) => this.excludeRestricted(views)),
    );
  }, this.clearCipherViewsForUser$);

  /** Overloaded so a caller's array type is kept rather than widened to an array of the union. */
  private excludeRestricted(views: CipherView[] | null): CipherView[] | null;
  private excludeRestricted(
    views: CipherView[] | CipherListView[] | null,
  ): CipherView[] | CipherListView[] | null;
  private excludeRestricted(views: CipherViewLike[] | null): CipherViewLike[] | null {
    return views == null ? views : views.filter((view) => !CipherViewLikeUtils.isRestricted(view));
  }

  cipherView$(userId: UserId, cipherId: CipherId): Observable<CipherView | undefined> {
    return this.cipherViews$(userId).pipe(
      filterOutNullish(),
      map((ciphers) => ciphers.find((cipher) => cipher.id === cipherId)),
    );
  }

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

  async setFailedDecryptedCiphers(cipherViews: CipherView[], userId: UserId) {
    await this.stateProvider.setUserState(FAILED_DECRYPTED_CIPHERS, cipherViews, userId);
  }

  /**
   * Drops ciphers for which we no longer have an organization key. Prevents decryption errors
   * before the encrypted cache updates, immediately after a user leaves an organization.
   */
  private async excludeCiphersMissingOrgKey<T extends { organizationId?: string }>(
    ciphers: T[],
    userId: UserId,
  ): Promise<T[]> {
    const keys = await firstValueFrom(this.keyService.cipherDecryptionKeys$(userId));
    const orgKeys = keys?.orgKeys;
    if (orgKeys == null) {
      return ciphers;
    }

    return ciphers.filter(
      (c) => c.organizationId == null || orgKeys[c.organizationId as OrganizationId] != null,
    );
  }

  async clearCache(userId?: UserId): Promise<void> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
    userId ??= activeUserId;

    // Force the cached cipherView$ observable(s) to emit a null value. Before the state write
    // below: a decrypt that finishes while it runs must not be overwritten by the null after,
    // which would leave the views null until the ciphers change again.
    this.clearCipherViewsForUser$.next(userId);
    await this.clearDecryptedCiphersState(userId);
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
    originalCipher: Cipher = null,
  ): Promise<EncryptionContext> {
    await this.adjustCipherHistory(model, userId, originalCipher);

    return await this.cipherEncryptionService.encrypt(model, userId);
  }

  async encryptMany(models: CipherView[], userId: UserId): Promise<EncryptionContext[]> {
    return await this.cipherEncryptionService.encryptMany(models, userId);
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
   *
   * Excludes restricted ciphers, so they never reach consumers such as export, autofill or key
   * rotation.
   * @deprecated Use `cipherViews$` observable instead
   */
  async getAllDecrypted(userId: UserId): Promise<CipherView[]> {
    const ciphers = await this.getAllDecryptedIncludingRestricted(userId);
    return ciphers.filter((cipher) => !CipherViewLikeUtils.isRestricted(cipher));
  }

  /**
   * Like {@link getAllDecrypted} but keeps restricted ciphers. Decrypts on every call: the decrypted
   * vault is not cached in state, which would keep every password decrypted for as long as the
   * vault is unlocked (in the extension, in session storage too).
   * Everything except {@link cipherViewsIncludingRestricted$} must go through {@link getAllDecrypted}.
   */
  private async getAllDecryptedIncludingRestricted(userId: UserId): Promise<CipherView[]> {
    // `localData` (e.g. lastUsedDate) is a client-only field the SDK does not populate on the
    // decrypted views. Re-attach it here so every consumer of `cipherViews$`/`getAllDecrypted`
    // sees it, matching the legacy and list-view decryption paths.
    let localData: Record<CipherId, LocalData> | undefined;

    // Wrap `localData` in try-catch so a failure to hydrate data doesn't cascade to a larger failed experience
    try {
      localData = await firstValueFrom(this.localData$(userId));
    } catch {
      localData = undefined;
    }

    try {
      const sdkMeasurement = this.logService.startMeasurement(
        PERF_TRACK_GROUP,
        PERF_TRACK,
        "getAllDecrypted",
      );
      // Without localData, which is re-attached below: a failure to read it must not fail this.
      const encrypted = Object.values(await firstValueFrom(this.ciphers$(userId)));
      const result = await this.cipherSdkService.decryptAll(
        encrypted.map((data) => new Cipher(data)),
        userId,
      );
      sdkMeasurement.finish([
        ["Items", result.successes.length],
        ["Failures", result.failures.length],
      ]);

      const sortedSuccesses = hydrateCiphersWithLocalData(result.successes, localData).sort(
        this.getLocaleSortingFunction(),
      );

      await this.setFailedDecryptedCiphers(result.failures, userId);

      return sortedSuccesses;
    } catch {
      // Return empty array on error to maintain existing behavior
      return [];
    }
  }

  /**
   * Decrypts a cipher using either the SDK or the legacy method based on the feature flag.
   * @param cipher The cipher to decrypt.
   * @param userId The user ID to use for decryption.
   * @returns A promise that resolves to the decrypted cipher view.
   */
  async decrypt(cipher: Cipher, userId: UserId): Promise<CipherView> {
    return await this.cipherEncryptionService.decrypt(cipher, userId);
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
    // Matches on list views, then fully decrypts the matches only: callers such as the badge
    // count run on every tab change, and a full decrypt of the vault would keep every password
    // decrypted in memory.
    const listViews = await this.loadedListViews(userId);
    const matches = await this.filterCiphersForUrl(
      listViews,
      url,
      includeOtherTypes,
      defaultMatch,
      overrideNeverMatchStrategy,
    );

    return this.decryptIds(userId, this.idsOf(matches));
  }

  async getAllDecryptedForIds(userId: UserId, ids: string[]): Promise<CipherView[]> {
    await this.loadedListViews(userId);
    return this.decryptIds(userId, ids);
  }

  /**
   * List views once decrypted, which also means the encrypted ciphers and keys are loaded.
   * Excludes restricted ciphers, like {@link cipherListViews$}.
   */
  private async loadedListViews(userId: UserId): Promise<CipherListView[]> {
    const views = await firstValueFrom(
      this.cipherListViewsIncludingRestricted$(userId).pipe(filterOutNullish()),
    );
    return views.filter((view) => !CipherViewLikeUtils.isRestricted(view));
  }

  private idsOf(listViews: CipherListView[]): string[] {
    return listViews.filter((view) => view.id != null).map((view) => uuidAsString(view.id!));
  }

  /**
   * Full views of the ciphers `ids`, in that order, decrypted on demand from the encrypted
   * state. Excludes restricted ciphers, like {@link cipherViews$}.
   */
  private async decryptIds(userId: UserId, ids: string[]): Promise<CipherView[]> {
    if (ids.length === 0) {
      return [];
    }

    const [encrypted, localData] = await Promise.all([
      firstValueFrom(this.ciphers$(userId)),
      firstValueFrom(this.localData$(userId)),
    ]);

    const ciphers: Cipher[] = [];
    for (const id of ids) {
      const data = encrypted[id as CipherId];
      if (data == null) {
        continue;
      }

      ciphers.push(new Cipher(data, localData[id as CipherId]));
    }

    const decryptable = await this.excludeCiphersMissingOrgKey(ciphers, userId);
    const { successes } = await this.cipherSdkService.decryptAll(decryptable, userId);
    const views = new Map(
      hydrateCiphersWithLocalData(successes, localData).map((view) => [view.id, view]),
    );

    return this.excludeRestricted(ids.map((id) => views.get(id)).filter((view) => view != null));
  }

  /** @inheritdoc */
  async getAllDecryptedForIdsIncludingRestricted(
    userId: UserId,
    ids: string[],
  ): Promise<CipherView[]> {
    return this.decryptedForIds(this.cipherViewsIncludingRestricted$(userId), ids);
  }

  /** Pick the requested ids out of a decrypted-view stream, once it has decrypted. */
  private decryptedForIds(
    views$: Observable<CipherView[] | null>,
    ids: string[],
  ): Promise<CipherView[]> {
    return firstValueFrom(
      views$.pipe(
        filter((ciphers) => ciphers != null),
        map((ciphers) => ciphers.filter((cipher) => ids.includes(cipher.id))),
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

    return ciphers.filter((cipher) => {
      const type = CipherViewLikeUtils.getType(cipher);
      const login = CipherViewLikeUtils.getLogin(cipher);
      const cipherIsLogin = login !== null;

      if (CipherViewLikeUtils.isDeleted(cipher)) {
        return false;
      }

      if (CipherViewLikeUtils.isArchived(cipher)) {
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
    // Picks the type on list views, so only ciphers of that type are fully decrypted.
    const listViews = (await this.loadedListViews(userId)).filter(
      (cipher) =>
        !CipherViewLikeUtils.isDeleted(cipher) &&
        !CipherViewLikeUtils.isArchived(cipher) &&
        type.includes(CipherViewLikeUtils.getType(cipher)),
    );

    const ciphers = await this.decryptIds(userId, this.idsOf(listViews));
    return ciphers.sort((a, b) => this.sortCiphersByLastUsedThenName(a, b));
  }

  async getAllFromApiForOrganization(
    organizationId: string,
    includeMemberItems = false,
  ): Promise<CipherView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (!userId) {
      throw new Error("User ID is required");
    }

    try {
      const [ciphers] = await this.cipherSdkService.getAllFromApiForOrganization(
        organizationId,
        userId,
        includeMemberItems,
      );

      const [cipherViews] = await this.cipherEncryptionService.decryptManyLegacy(ciphers, userId);

      // Sort by locale (matching existing behavior)
      cipherViews.sort(this.getLocaleSortingFunction());

      return cipherViews;
    } catch {
      // Return empty array on error to maintain existing behavior
      return [];
    }
  }

  async getManyFromApiForOrganization(organizationId: string): Promise<CipherView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (!userId) {
      throw new Error("User ID is required");
    }

    try {
      const [ciphers] = await this.cipherSdkService.getManyFromApiForOrganization(
        organizationId,
        userId,
      );

      const [cipherViews] = await this.cipherEncryptionService.decryptManyLegacy(ciphers, userId);

      cipherViews.sort(this.getLocaleSortingFunction());

      return cipherViews;
    } catch {
      return [];
    }
  }

  async getCiphersOrganizationLogins(organizationId: string): Promise<DecryptAllCiphersResult> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (!userId) {
      throw new Error("User ID is required");
    }

    const result = await this.cipherSdkService.getOrganizationLoginCiphers(organizationId, userId);
    result.successes.sort(this.getLocaleSortingFunction());

    return result;
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
  }

  async updateLastLaunchedDate(id: string, userId: UserId): Promise<void> {
    let ciphersLocalData = await firstValueFrom(this.localData$(userId));

    if (!ciphersLocalData) {
      ciphersLocalData = {};
    }

    const currentTime = new Date().getTime();
    ciphersLocalData[id as CipherId] = { lastLaunched: currentTime, lastUsedDate: currentTime };

    await this.localDataState(userId).update(() => ciphersLocalData);
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
    cipherView: CipherView,
    userId: UserId,
    orgAdmin?: boolean,
  ): Promise<CipherView> {
    // Clear the cache before creating the cipher. The SDK internally updates the encrypted storage
    // but the timing of the storage emitting the new values differs across platforms. Clearing the cache after
    // `createWithServer` can cause race conditions where the cache is cleared after the
    // encrypted storage has already been updated and thus downstream consumers not getting updated data.
    await this.clearCache(userId);

    const resultCipherView = await this.cipherSdkService.createWithServer(
      cipherView,
      userId,
      orgAdmin,
    );
    return resultCipherView || new CipherView();
  }

  async updateWithServer(
    cipherView: CipherView,
    userId: UserId,
    originalCipherView?: CipherView,
    orgAdmin?: boolean,
  ): Promise<CipherView> {
    if (orgAdmin) {
      return await this.updateWithServerUsingSdk(cipherView, userId, originalCipherView, orgAdmin);
    }

    // Only the SDK routes a change to a restricted cipher: it diffs password history against the
    // full original and keeps the stored copy restricted. Admin Console saves stay exempt.
    // The SDK service maps its own refusals of a restricted cipher to RestrictedCipherWriteError.
    const stored = await this.get(cipherView.id, userId);
    const route = await this.resolveUpdateRoute(cipherView, stored, userId);
    return route === CipherUpdateRoute.UserFields
      ? await this.updateUserFieldsWithServer(cipherView, userId)
      : await this.updateItemWithServer(cipherView, stored, userId, originalCipherView);
  }

  private async updateWithServerUsingSdk(
    cipherView: CipherView,
    userId: UserId,
    originalCipherView?: CipherView,
    orgAdmin?: boolean,
  ): Promise<CipherView> {
    // Clear the cache before updating the cipher. The SDK internally updates the encrypted storage
    // but the timing of the storage emitting the new values differs across platforms. Clearing the cache after
    // `updateWithServer` can cause race conditions where the cache is cleared after the
    // encrypted storage has already been updated and thus downstream consumers not getting updated data.
    await this.clearCache(userId);

    const resultCipherView = await this.cipherSdkService.updateWithServer(
      cipherView,
      userId,
      originalCipherView,
      orgAdmin,
    );
    return resultCipherView;
  }

  /**
   * The save route for a change to an existing cipher (first match wins). A restricted request
   * view can only change user fields; anything else is refused with no network call.
   */
  private async resolveUpdateRoute(
    cipherView: CipherView,
    stored: Cipher | null,
    userId: UserId,
  ): Promise<CipherUpdateRoute> {
    if (CipherViewLikeUtils.isRestricted(cipherView)) {
      if (stored == null || !(await this.onlyUserFieldsChanged(cipherView, stored, userId))) {
        throw new RestrictedCipherWriteError();
      }
      return CipherUpdateRoute.UserFields;
    }
    return cipherView.edit ? CipherUpdateRoute.Item : CipherUpdateRoute.UserFields;
  }

  /**
   * True when the request differs from the stored cipher in user fields only. Compares the SDK
   * edit requests, so every field the SDK would send is covered, new item types included.
   */
  private async onlyUserFieldsChanged(
    cipherView: CipherView,
    stored: Cipher,
    userId: UserId,
  ): Promise<boolean> {
    const storedView = await this.decrypt(stored, userId);
    storedView.folderId = cipherView.folderId;
    storedView.favorite = cipherView.favorite;
    const comparable = (view: CipherView) =>
      JSON.stringify({ ...view.toSdkUpdateCipherRequest(), revisionDate: undefined });
    return comparable(storedView) === comparable(cipherView);
  }

  private async updateUserFieldsWithServer(
    cipherView: CipherView,
    userId: UserId,
  ): Promise<CipherView> {
    // Cleared before the write for the same reason as in `updateWithServerUsingSdk`.
    await this.clearCache(userId);
    return await this.cipherSdkService.updateUserFieldsWithServer(cipherView, userId);
  }

  /**
   * A full edit. The stored original comes first; a restricted stored copy needs the full
   * `originalCipherView` (the revealed view) of the same cipher, and returns a restricted result.
   */
  private async updateItemWithServer(
    cipherView: CipherView,
    stored: Cipher | null,
    userId: UserId,
    originalCipherView?: CipherView,
  ): Promise<CipherView> {
    if (!stored?.isPartial) {
      return await this.updateWithServerUsingSdk(cipherView, userId, originalCipherView);
    }
    if (
      originalCipherView == null ||
      CipherViewLikeUtils.isRestricted(originalCipherView) ||
      originalCipherView.id !== cipherView.id
    ) {
      throw new RestrictedCipherWriteError();
    }
    await this.clearCache(userId);
    return await this.cipherSdkService.updateWithRevealedOriginal(
      cipherView,
      originalCipherView,
      userId,
    );
  }

  async shareWithServer(
    cipher: CipherView,
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
    originalCipherView?: CipherView,
  ): Promise<Cipher> {
    if (cipher.organizationId != null) {
      throw new Error("Cipher is already associated with an organization.");
    }

    await this.clearCache(userId);
    const result = await this.cipherSdkService.shareWithServer(
      cipher,
      organizationId as OrganizationId,
      collectionIds as CollectionId[],
      userId,
      originalCipherView,
    );

    if (result == null) {
      throw new Error("Failed to share cipher: no result returned from SDK");
    }

    const encryptResult = await this.cipherEncryptionService.encrypt(result, userId);
    return encryptResult.cipher;
  }

  async shareManyWithServer(
    ciphers: CipherView[],
    organizationId: string,
    collectionIds: string[],
    userId: UserId,
  ): Promise<void> {
    for (const cipher of ciphers) {
      if (cipher.organizationId != null) {
        throw new Error("Cipher is already associated with an organization.");
      }
    }

    await this.clearCache(userId);
    await this.cipherSdkService.shareManyWithServer(
      ciphers,
      organizationId as OrganizationId,
      collectionIds as CollectionId[],
      userId,
    );
  }

  saveAttachmentWithServer(
    cipher: Cipher,
    unencryptedFile: any,
    userId: UserId,
    admin = false,
    options?: UploadOptions,
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
            options,
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
    options?: UploadOptions,
  ): Promise<Cipher> {
    // The organization's symmetric key or the user's user key
    const vaultKey: UserKey | OrgKey =
      cipher.organizationId == null
        ? await firstValueFrom(this.keyService.userKey$(userId))
        : await firstValueFrom(
            this.keyService
              .orgKeys$(userId)
              .pipe(map((orgKeys) => orgKeys[cipher.organizationId as OrganizationId] as OrgKey)),
          );

    const cipherKeyOrVaultKey =
      cipher.key != null
        ? ((await this.encryptService.unwrapSymmetricKey(cipher.key, vaultKey)) as UserKey)
        : vaultKey;

    const encFileName = await this.encryptService.encryptString(filename, cipherKeyOrVaultKey);

    const attachmentKey = await this.legacyCompatKeyService.makeDataEncKey(cipherKeyOrVaultKey);
    const encData = await this.encryptService.encryptFileData(
      new Uint8Array(data),
      attachmentKey[0],
    );

    await this.clearCache(userId);

    const created = await this.cipherSdkService.createAttachment(
      cipher.id as CipherId,
      {
        key: attachmentKey[1].encryptedString,
        fileName: encFileName.encryptedString,
        fileSize: encData.buffer.byteLength,
        lastKnownRevisionDate: cipher.revisionDate.toISOString(),
      },
      userId,
      admin,
    );

    await this.cipherFileUploadService.uploadPrepared(
      cipher.id,
      created.attachmentId,
      created.uploadUrl,
      created.fileUploadType === "Direct" ? FileUploadType.Direct : FileUploadType.Azure,
      encFileName,
      encData,
      userId,
      admin,
      options,
    );

    if (admin) {
      // Admin ops bypass local state; the SDK returns the merged cipher inline.
      return Cipher.fromSdkCipher(created.cipher) ?? cipher;
    }

    return await this.get(cipher.id, userId);
  }

  async saveCollectionsWithServer(cipher: Cipher, userId: UserId): Promise<Cipher> {
    await this.clearCache(userId);
    const cipherView = await this.cipherSdkService.saveCollectionsWithServer(
      cipher.id,
      cipher.collectionIds,
      userId,
    );
    // The user no longer has access to the cipher after the collection change
    if (cipherView == null) {
      await this.delete(cipher.id, userId);
      return undefined;
    }
    const encryptResult = await this.cipherEncryptionService.encrypt(cipherView, userId);
    return encryptResult.cipher;
  }

  async saveCollectionsWithServerAdmin(cipher: Cipher): Promise<Cipher> {
    const userId = await firstValueFrom(this.stateProvider.activeUserId$);
    await this.clearCache(userId);
    const cipherView = await this.cipherSdkService.saveCollectionsWithServerAdmin(
      cipher.id,
      cipher.collectionIds,
      userId,
    );
    const encryptResult = await this.cipherEncryptionService.encrypt(cipherView, userId);
    return encryptResult.cipher;
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
    await this.clearCache(userId);
    await this.cipherSdkService.bulkUpdateCollectionsWithServer(
      orgId,
      userId,
      cipherIds,
      collectionIds,
      removeCollections,
    );
  }

  async upsert(
    cipher: CipherData | CipherData[],
    userId?: UserId,
  ): Promise<Record<CipherId, CipherData>> {
    const ciphers = cipher instanceof CipherData ? [cipher] : cipher;
    const res = await this.updateEncryptedCipherState((current) => {
      ciphers.forEach((c) => (current[c.id as CipherId] = c));
      return current;
    }, userId);
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
    await this.clearCache(userId);
    await this.cipherSdkService.moveManyWithServer(ids, folderId, userId);
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

  async deleteWithServer(id: string, userId: UserId, asAdmin = false): Promise<void> {
    await this.clearCache(userId);
    await this.cipherSdkService.deleteWithServer(id, userId, asAdmin);
  }

  async deleteManyWithServer(
    ids: string[],
    userId: UserId,
    asAdmin = false,
    orgId?: OrganizationId,
  ): Promise<void> {
    await this.clearCache(userId);
    await this.cipherSdkService.deleteManyWithServer(ids, userId, asAdmin, orgId);
  }

  async deleteAttachmentWithServer(
    id: string,
    attachmentId: string,
    userId: UserId,
    admin: boolean = false,
  ): Promise<CipherData> {
    await this.clearCache(userId);
    const updatedCipher = await this.cipherSdkService.deleteAttachmentWithServer(
      id as CipherId,
      attachmentId,
      userId,
      admin,
    );
    return updatedCipher?.toCipherData();
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

  async softDelete(id: string | string[], userId: UserId): Promise<void> {
    let ciphers = await firstValueFrom(this.ciphers$(userId));
    if (ciphers == null) {
      return;
    }

    const setDeletedDate = (cipherId: CipherId) => {
      if (ciphers[cipherId] == null) {
        return;
      }
      ciphers[cipherId].deletedDate = new Date().toISOString();
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

  async softDeleteWithServer(id: string, userId: UserId, asAdmin = false): Promise<void> {
    await this.clearCache(userId);
    await this.cipherSdkService.softDeleteWithServer(id, userId, asAdmin);
  }

  async softDeleteManyWithServer(
    ids: string[],
    userId: UserId,
    asAdmin = false,
    orgId?: OrganizationId,
  ): Promise<void> {
    await this.clearCache(userId);
    await this.cipherSdkService.softDeleteManyWithServer(ids, userId, asAdmin, orgId);
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

  async restoreWithServer(id: string, userId: UserId, asAdmin = false): Promise<void> {
    await this.clearCache(userId);
    await this.cipherSdkService.restoreWithServer(id, userId, asAdmin);
  }

  /**
   * No longer using an asAdmin Param. Org Vault bulkRestore will assess if an item is unassigned or editable
   * The Org Vault will pass those ids an array as well as the orgId when calling bulkRestore
   */
  async restoreManyWithServer(ids: string[], userId: UserId, orgId?: string): Promise<void> {
    await this.clearCache(userId);
    await this.cipherSdkService.restoreManyWithServer(ids, userId, orgId);
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

    encryptedCiphers = await Promise.all(
      userCiphers.map(async (cipher) => {
        const encryptedCipher = await this.cipherEncryptionService.encryptCipherForRotation(
          cipher,
          userId,
          newUserKey,
        );
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
    const cipherDomain = await firstValueFrom(
      this.ciphers$(userId).pipe(map((ciphersData) => new Cipher(ciphersData[cipherId]))),
    );

    if (!useLegacyDecryption) {
      const encryptedContent = await response.arrayBuffer();
      return this.cipherEncryptionService.decryptAttachmentContent(
        cipherDomain,
        attachment,
        new Uint8Array(encryptedContent),
        userId,
      );
    }

    // The SDK doesn't currently support emergency access for attachments, so we need to keep this legacy path
    // until the SDK is updated to support it.
    const encBuf = await EncArrayBuffer.fromResponse(response);
    const key =
      attachment.key != null
        ? attachment.key
        : cipherDomain.organizationId
          ? await firstValueFrom(
              this.keyService.orgKeys$(userId).pipe(
                filterOutNullish(),
                map((orgKeys) => orgKeys[cipherDomain.organizationId as OrganizationId] as OrgKey),
              ),
            )
          : await firstValueFrom(this.keyService.userKey$(userId).pipe(filterOutNullish()));
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

  /**
   * Upgrade all old attachments for a cipher by downloading, decrypting, re-uploading with new key, and deleting old.
   * @param cipher
   * @param userId
   * @param attachmentId Optional specific attachment ID to upgrade. If not provided, all old attachments will be upgraded.
   */
  async upgradeOldCipherAttachments(
    cipher: CipherView,
    userId: UserId,
    attachmentId?: string,
  ): Promise<CipherView> {
    if (!cipher.hasOldAttachments) {
      return cipher;
    }

    let upgradedView: CipherView | undefined;

    for (const attachmentView of cipher.attachments) {
      if (
        attachmentView.key != null ||
        (attachmentId != null && attachmentView.id !== attachmentId)
      ) {
        continue;
      }

      try {
        await this.clearCache(userId);
        upgradedView = await this.cipherSdkService.upgradeAttachment(
          cipher.id as CipherId,
          attachmentView.id,
          userId,
        );
      } catch (e) {
        this.logService.error(`Failed to upgrade attachment ${attachmentView.id}`, e);
        throw e;
      }
    }

    return upgradedView ?? (await this.decrypt(await this.get(cipher.id, userId), userId));
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

      // `getAllDecryptedForUrl` already hydrates localData at the source, but this path
      // caches the result in `sortedCiphersCache` and is read immediately after a
      // lastLaunched/lastUsed update before `cipherViews$` necessarily re-decrypts.
      // Re-hydrate from the current localData$ so the correct cipher is selected
      // regardless of that emission timing.
      const localData = await firstValueFrom(this.localData$(userId));
      ciphers = hydrateCiphersWithLocalData(ciphers, localData);

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
    // Use null (not {}) so that cipherListViews$/cipherViews$ filter it out
    // and don't emit an empty array during sync.
    await this.stateProvider.setUserState(ENCRYPTED_CIPHERS, null, userId);
  }

  private async clearDecryptedCiphersState(userId: UserId) {
    await this.setFailedDecryptedCiphers(null, userId);
    this.clearSortedCiphers();
  }

  private clearSortedCiphers() {
    this.sortedCiphersCache.clear();
  }

  /**
   * Decrypts the provided ciphers into lightweight `CipherListView`s using the SDK.
   * @returns A tuple of the decrypted list views (sorted by locale) and the ciphers that failed to decrypt.
   */
  private async decryptCiphersWithSdk(
    ciphers: Cipher[],
    userId: UserId,
  ): Promise<[CipherListView[], CipherView[]]> {
    // Fixes a bug causing decryption failures immediately after a user leaves an organization.
    const decryptableCiphers = await this.excludeCiphersMissingOrgKey(ciphers, userId);

    // Short-circuit if there are no ciphers to decrypt
    // Observables reacting to key changes may attempt to decrypt with a stale SDK reference.
    if (decryptableCiphers.length === 0) {
      return [[], []];
    }

    const [decrypted, failures] = await this.cipherEncryptionService.decryptManyWithFailures(
      decryptableCiphers,
      userId,
    );

    const failedViews = failures.map((c) => {
      const cipher_view = new CipherView(c);
      cipher_view.name = "[error: cannot decrypt]";
      cipher_view.decryptionFailure = true;
      return cipher_view;
    });

    return [decrypted.sort(this.getLocaleSortingFunction()), failedViews];
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
