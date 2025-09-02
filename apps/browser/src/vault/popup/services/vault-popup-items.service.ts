import { inject, Injectable, NgZone } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  map,
  merge,
  MonoTypeOperatorFunction,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  tap,
  withLatestFrom,
} from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { CipherArchiveService } from "@bitwarden/vault";

import { runInsideAngular } from "../../../platform/browser/run-inside-angular.operator";
import { PopupViewCacheService } from "../../../platform/popup/view-cache/popup-view-cache.service";
import { waitUntil } from "../../util";
import { PopupCipherViewLike } from "../views/popup-cipher.view";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";
import { MY_VAULT_ID, VaultPopupListFiltersService } from "./vault-popup-list-filters.service";

/**
 * Service for managing the various item lists on the new Vault tab in the browser popup.
 */
@Injectable({
  providedIn: "root",
})
export class VaultPopupItemsService {
  private cachedSearchText = inject(PopupViewCacheService).signal<string>({
    key: "vault-search-text",
    initialValue: "",
    persistNavigation: true,
  });

  readonly searchText$ = toObservable(this.cachedSearchText);

  /**
   * Subject that emits whenever new ciphers are being processed/filtered.
   * @private
   */
  private _ciphersLoading$ = new Subject<void>();

  private activeUserId$ = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filter((userId): userId is UserId => userId !== null),
  );

  private organizations$ = this.activeUserId$.pipe(
    switchMap((userId) => this.organizationService.organizations$(userId)),
  );

  private decryptedCollections$ = this.activeUserId$.pipe(
    switchMap((userId) => this.collectionService.decryptedCollections$(userId)),
  );

  /**
   * Observable that contains the list of other cipher types that should be shown
   * in the autofill section of the Vault tab. Depends on vault settings.
   * @private
   */
  private _otherAutoFillTypes$: Observable<CipherType[]> = combineLatest([
    this.vaultSettingsService.showCardsCurrentTab$,
    this.vaultSettingsService.showIdentitiesCurrentTab$,
    this.vaultPopupAutofillService.nonLoginCipherTypesOnPage$,
  ]).pipe(
    map(([showCardsSettingEnabled, showIdentitiesSettingEnabled, nonLoginCipherTypesOnPage]) => {
      const showCards = showCardsSettingEnabled || nonLoginCipherTypesOnPage[CipherType.Card];
      const showIdentities =
        showIdentitiesSettingEnabled || nonLoginCipherTypesOnPage[CipherType.Identity];

      return [
        ...(showCards ? [CipherType.Card] : []),
        ...(showIdentities ? [CipherType.Identity] : []),
      ];
    }),
  );

  /**
   * Observable that contains the list of all decrypted ciphers.
   * @private
   */
  private _allDecryptedCiphers$: Observable<CipherViewLike[]> =
    this.accountService.activeAccount$.pipe(
      map((a) => a?.id),
      filter((userId): userId is UserId => userId != null),
      switchMap((userId) =>
        merge(this.cipherService.ciphers$(userId), this.cipherService.localData$(userId)).pipe(
          runInsideAngular(this.ngZone),
          tap(() => this._ciphersLoading$.next()),
          waitUntilSync(this.syncService),
          switchMap(() =>
            combineLatest([
              this.cipherService
                .cipherListViews$(userId)
                .pipe(filter((ciphers) => ciphers != null)),
              this.cipherService.failedToDecryptCiphers$(userId),
              this.restrictedItemTypesService.restricted$.pipe(startWith([])),
            ]),
          ),
          map(([ciphers, failedToDecryptCiphers, restrictions]) => {
            const allCiphers = [...(failedToDecryptCiphers || []), ...ciphers];

            return allCiphers.filter(
              (cipher) => !this.restrictedItemTypesService.isCipherRestricted(cipher, restrictions),
            );
          }),
        ),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  private userCanArchive$ = this.activeUserId$.pipe(
    switchMap((userId) => {
      return this.cipherArchiveService.userCanArchive(userId).then((canArchive) => canArchive);
    }),
  );

  private _activeCipherList$: Observable<PopupCipherViewLike[]> = this._allDecryptedCiphers$.pipe(
    switchMap((ciphers) =>
      combineLatest([this.organizations$, this.decryptedCollections$, this.userCanArchive$]).pipe(
        map(([organizations, collections, canArchive]) => {
          const orgMap = Object.fromEntries(organizations.map((org) => [org.id, org]));
          const collectionMap = Object.fromEntries(collections.map((col) => [col.id, col]));
          return ciphers
            .filter(
              (c) =>
                !CipherViewLikeUtils.isDeleted(c) &&
                (!canArchive || !CipherViewLikeUtils.isArchived(c)),
            )
            .map((cipher) => {
              (cipher as PopupCipherViewLike).collections = cipher.collectionIds?.map(
                (colId) => collectionMap[colId as CollectionId],
              );
              (cipher as PopupCipherViewLike).organization =
                orgMap[cipher.organizationId as OrganizationId];
              return cipher;
            });
        }),
      ),
    ),
  );

  /**
   * Observable that indicates whether there is search text present that is searchable.
   * @private
   */
  private _hasSearchText = combineLatest([
    this.searchText$,
    getUserId(this.accountService.activeAccount$),
  ]).pipe(
    switchMap(([searchText, userId]) => {
      return this.searchService.isSearchable(userId, searchText);
    }),
  );

  private _filteredCipherList$: Observable<PopupCipherViewLike[]> = combineLatest([
    this._activeCipherList$,
    this.searchText$,
    this.vaultPopupListFiltersService.filterFunction$,
    getUserId(this.accountService.activeAccount$),
  ]).pipe(
    map(
      ([ciphers, searchText, filterFunction, userId]): [PopupCipherViewLike[], string, UserId] => [
        filterFunction(ciphers),
        searchText,
        userId,
      ],
    ),
    switchMap(
      ([ciphers, searchText, userId]) =>
        this.searchService.searchCiphers(userId, searchText, undefined, ciphers) as Promise<
          PopupCipherViewLike[]
        >,
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * List of ciphers that can be used for autofill on the current tab. Includes cards and/or identities
   * if enabled in the vault settings. Ciphers are sorted by type, then by last used date, then by name.
   *
   * See {@link refreshCurrentTab} to trigger re-evaluation of the current tab.
   */
  autoFillCiphers$: Observable<PopupCipherViewLike[]> = combineLatest([
    this._filteredCipherList$,
    this._otherAutoFillTypes$,
    this.vaultPopupAutofillService.currentAutofillTab$,
  ]).pipe(
    switchMap(([ciphers, otherTypes, tab]) => {
      if (!tab || !tab.url) {
        return of([]);
      }
      return this.cipherService.filterCiphersForUrl(ciphers, tab.url, otherTypes);
    }),
    map((ciphers) => ciphers.sort(this.sortCiphersForAutofill.bind(this))),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /**
   * List of favorite ciphers that are not currently suggested for autofill.
   * Ciphers are sorted by name.
   */
  favoriteCiphers$: Observable<PopupCipherViewLike[]> = this.autoFillCiphers$.pipe(
    withLatestFrom(this._filteredCipherList$),
    map(([autoFillCiphers, ciphers]) =>
      ciphers.filter((cipher) => cipher.favorite && !autoFillCiphers.includes(cipher)),
    ),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /**
   * List of all remaining ciphers that are not currently suggested for autofill or marked as favorite.
   * Ciphers are sorted by name.
   */
  remainingCiphers$: Observable<PopupCipherViewLike[]> = this.favoriteCiphers$.pipe(
    concatMap(
      (
        favoriteCiphers, // concatMap->of is used to make withLatestFrom lazy to avoid race conditions with autoFillCiphers$
      ) =>
        of(favoriteCiphers).pipe(withLatestFrom(this._filteredCipherList$, this.autoFillCiphers$)),
    ),
    map(([favoriteCiphers, ciphers, autoFillCiphers]) =>
      ciphers.filter(
        (cipher) => !autoFillCiphers.includes(cipher) && !favoriteCiphers.includes(cipher),
      ),
    ),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /**
   * Observable that indicates whether the service is currently loading ciphers.
   */
  loading$: Observable<boolean> = merge(
    this._ciphersLoading$.pipe(map(() => true)),
    this.remainingCiphers$.pipe(map(() => false)),
  ).pipe(startWith(true), distinctUntilChanged(), shareReplay({ refCount: false, bufferSize: 1 }));

  /**
   * Observable that indicates whether a filter or search text is currently applied to the ciphers.
   */
  hasFilterApplied$ = combineLatest([
    this._hasSearchText,
    this.vaultPopupListFiltersService.filters$,
  ]).pipe(
    map(([hasSearchText, filters]) => {
      return hasSearchText || Object.values(filters).some((filter) => filter !== null);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Observable that indicates whether the user's vault is empty.
   */
  emptyVault$: Observable<boolean> = this._activeCipherList$.pipe(
    map((ciphers) => !ciphers.length),
  );

  /**
   * Observable that indicates whether there are no ciphers to show with the current filter.
   */
  noFilteredResults$: Observable<boolean> = this._filteredCipherList$.pipe(
    map((ciphers) => !ciphers.length),
  );

  /** Observable that indicates when the user should see the deactivated org state */
  showDeactivatedOrg$: Observable<boolean> = combineLatest([
    this.vaultPopupListFiltersService.filters$.pipe(distinctUntilKeyChanged("organization")),
    this.organizations$,
  ]).pipe(
    map(([filters, orgs]) => {
      if (!filters.organization || filters.organization.id === MY_VAULT_ID) {
        return false;
      }

      const org = orgs.find((o) => o.id === filters?.organization?.id);
      return org ? !org.enabled : false;
    }),
  );

  /**
   * Observable that contains the list of ciphers that have been deleted.
   */
  deletedCiphers$: Observable<PopupCipherViewLike[]> = this._allDecryptedCiphers$.pipe(
    switchMap((ciphers) =>
      combineLatest([this.organizations$, this.decryptedCollections$]).pipe(
        map(([organizations, collections]) => {
          const orgMap = Object.fromEntries(organizations.map((org) => [org.id, org]));
          const collectionMap = Object.fromEntries(collections.map((col) => [col.id, col]));
          return ciphers
            .filter((c) => CipherViewLikeUtils.isDeleted(c))
            .map(
              (cipher) =>
                ({
                  ...cipher,
                  collections: cipher.collectionIds?.map(
                    (colId) => collectionMap[colId as CollectionId],
                  ),
                  organization: orgMap[cipher.organizationId as OrganizationId],
                }) as PopupCipherViewLike,
            );
        }),
      ),
    ),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  constructor(
    private cipherService: CipherService,
    private vaultSettingsService: VaultSettingsService,
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private organizationService: OrganizationService,
    private searchService: SearchService,
    private collectionService: CollectionService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private syncService: SyncService,
    private accountService: AccountService,
    private ngZone: NgZone,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private configService: ConfigService,
    private cipherArchiveService: CipherArchiveService,
  ) {}

  applyFilter(newSearchText: string) {
    this.cachedSearchText.set(newSearchText);
  }

  /**
   * Sort function for ciphers to be used in the autofill section of the Vault tab.
   * Sorts by type, then by last used date, and finally by name.
   * @private
   */
  private sortCiphersForAutofill(a: CipherViewLike, b: CipherViewLike): number {
    const typeOrder = {
      [CipherType.Login]: 1,
      [CipherType.Card]: 2,
      [CipherType.Identity]: 3,
      [CipherType.SecureNote]: 4,
      [CipherType.SshKey]: 5,
    } as Record<CipherType, number>;

    const aType = CipherViewLikeUtils.getType(a);
    const bType = CipherViewLikeUtils.getType(b);

    // Compare types first
    if (typeOrder[aType] < typeOrder[bType]) {
      return -1;
    } else if (typeOrder[aType] > typeOrder[bType]) {
      return 1;
    }

    // If types are the same, then sort by last used then name
    return this.cipherService.sortCiphersByLastUsedThenName(a, b);
  }
}

/**
 * Operator that waits until the active account has synced at least once before allowing the source to continue emission.
 * @param syncService
 */
const waitUntilSync = <T>(syncService: SyncService): MonoTypeOperatorFunction<T> => {
  return waitUntil(syncService.activeUserLastSync$().pipe(filter((lastSync) => lastSync != null)));
};
