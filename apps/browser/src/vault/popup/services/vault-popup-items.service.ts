import { inject, Injectable, NgZone } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  from,
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
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { runInsideAngular } from "../../../platform/browser/run-inside-angular.operator";
import { PopupViewCacheService } from "../../../platform/popup/view-cache/popup-view-cache.service";
import { waitUntil } from "../../util";
import { PopupCipherViewLike } from "../views/popup-cipher.view";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";
import { MY_VAULT_ID, VaultPopupListFiltersService } from "./vault-popup-list-filters.service";

export interface CrossAccountSearchResult {
  userId: UserId;
  email: string;
  hostname: string;
  label: string;
  ciphers: PopupCipherViewLike[];
}

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
              this.cipherService.failedToDecryptCiphers$(userId).pipe(startWith([])),
              this.restrictedItemTypesService.restricted$,
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

  private _activeCipherList$: Observable<PopupCipherViewLike[]> = this._allDecryptedCiphers$.pipe(
    switchMap((ciphers) =>
      combineLatest([this.organizations$, this.decryptedCollections$]).pipe(
        map(([organizations, collections]) => {
          const orgMap = Object.fromEntries(organizations.map((org) => [org.id, org]));
          const collectionMap = Object.fromEntries(collections.map((col) => [col.id, col]));
          return ciphers
            .filter((c) => !CipherViewLikeUtils.isDeleted(c) && !CipherViewLikeUtils.isArchived(c))

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
   * List of ciphers that are filtered using filters and search.
   * Includes favorite ciphers and ciphers currently suggested for autofill.
   * Ciphers are sorted by name.
   */
  filteredCiphers$: Observable<PopupCipherViewLike[]> = this._filteredCipherList$.pipe(
    shareReplay({ refCount: false, bufferSize: 1 }),
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
   * Observable that indicates whether the service is currently loading ciphers.
   */
  loading$: Observable<boolean> = merge(
    this._ciphersLoading$.pipe(map(() => true)),
    this.favoriteCiphers$.pipe(map(() => false)),
  ).pipe(startWith(true), distinctUntilChanged(), shareReplay({ refCount: false, bufferSize: 1 }));

  /**
   * Label for the active account's search results section, showing instance hostname and email.
   */
  activeAccountSearchLabel$: Observable<string | null> = combineLatest([
    this.activeUserId$,
    this.accountService.accounts$,
    this.authService.authStatuses$,
  ]).pipe(
    switchMap(([userId, accounts, statuses]) => {
      const hasOtherUnlocked = Object.keys(accounts).some(
        (id) => id !== userId && statuses[id as UserId] === AuthenticationStatus.Unlocked,
      );
      if (!hasOtherUnlocked) {
        return of(null);
      }
      return this.environmentService.getEnvironment$(userId).pipe(
        map((env) => {
          const hostname = env.getHostname();
          const email = accounts[userId]?.email ?? "";
          return `${hostname} (${email})`;
        }),
      );
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /** Observable that indicates whether there is search text present.
   */
  hasSearchText$: Observable<boolean> = this._hasSearchText.pipe(
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Search results from other unlocked accounts.
   * Emits an empty array when there is no search text or no other unlocked accounts.
   * While loading, emits placeholder entries with empty cipher arrays so that
   * combineLatest does not block.
   */
  otherAccountSearchResults$: Observable<CrossAccountSearchResult[]> = combineLatest([
    this._hasSearchText,
    this.searchText$.pipe(debounceTime(150)),
    this.accountService.accounts$,
    this.authService.authStatuses$,
    this.activeUserId$,
  ]).pipe(
    switchMap(([hasSearchText, searchText, accounts, statuses, activeUserId]) => {
      if (!hasSearchText) {
        return of([]);
      }

      const otherUnlockedIds = Object.keys(accounts)
        .map((id) => id as UserId)
        .filter((id) => id !== activeUserId && statuses[id] === AuthenticationStatus.Unlocked);

      if (!otherUnlockedIds.length) {
        return of([]);
      }

      const searches$ = otherUnlockedIds.map((userId) =>
        combineLatest([
          this.cipherService.cipherListViews$(userId).pipe(filter((ciphers) => ciphers != null)),
          this.cipherService.failedToDecryptCiphers$(userId).pipe(startWith([])),
          this.environmentService.getEnvironment$(userId),
          this.organizationService.organizations$(userId),
          this.collectionService.decryptedCollections$(userId),
          this.policyService.policiesByType$(PolicyType.RestrictedItemTypes, userId),
        ]).pipe(
          switchMap(
            ([ciphers, failedToDecryptCiphers, env, organizations, collections, policies]) => {
              const orgMap = Object.fromEntries(organizations.map((org) => [org.id, org]));
              const collectionMap = Object.fromEntries(collections.map((col) => [col.id, col]));

              // Build per-account restrictions from that account's policies
              const perAccountRestrictions = buildRestrictedTypes(organizations, policies);

              const allCiphers = [
                ...(failedToDecryptCiphers || []),
                ...(ciphers as CipherViewLike[]),
              ];
              const filtered = allCiphers
                .filter(
                  (c) =>
                    !CipherViewLikeUtils.isDeleted(c) &&
                    !CipherViewLikeUtils.isArchived(c) &&
                    !this.restrictedItemTypesService.isCipherRestricted(c, perAccountRestrictions),
                )
                .map(
                  (cipher) =>
                    ({
                      ...cipher,
                      organization: orgMap[cipher.organizationId as OrganizationId],
                      collections: cipher.collectionIds?.map(
                        (colId: string) => collectionMap[colId as CollectionId],
                      ),
                    }) as PopupCipherViewLike,
                );
              const hostname = env.getHostname();
              const email = accounts[userId]?.email ?? "";
              return from(
                this.searchService.searchCiphers(userId, searchText, undefined, filtered),
              ).pipe(
                map(
                  (results): CrossAccountSearchResult => ({
                    userId,
                    email,
                    hostname,
                    label: `${hostname} (${email})`,
                    ciphers: results as PopupCipherViewLike[],
                  }),
                ),
              );
            },
          ),
          // Emit placeholder while search loads so combineLatest doesn't block
          startWith({
            userId,
            email: accounts[userId]?.email ?? "",
            hostname: "",
            label: accounts[userId]?.email ?? "",
            ciphers: [] as PopupCipherViewLike[],
          } as CrossAccountSearchResult),
        ),
      );

      return combineLatest(searches$);
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

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
   * Observable that contains the count of ciphers in the active filtered list.
   */
  cipherCount$: Observable<number> = this._activeCipherList$.pipe(map((ciphers) => ciphers.length));

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
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private ngZone: NgZone,
    private restrictedItemTypesService: RestrictedItemTypesService,
    private policyService: PolicyService,
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
 * Build per-account restricted cipher types from that account's organizations and policies.
 * Mirrors the logic in RestrictedItemTypesService.restricted$ but for an arbitrary account.
 */
function buildRestrictedTypes(
  orgs: Organization[],
  enabledPolicies: Policy[],
): RestrictedCipherType[] {
  const restrictedTypes = (p: Policy) => (p.data as CipherType[]) ?? [CipherType.Card];
  const allRestrictedTypes = Array.from(new Set(enabledPolicies.flatMap(restrictedTypes)));

  return allRestrictedTypes.map((cipherType) => {
    const allowViewOrgIds = orgs
      .filter((org) => {
        const orgPolicy = enabledPolicies.find((p) => p.organizationId === org.id);
        if (!orgPolicy) {
          return true;
        }
        return !restrictedTypes(orgPolicy).includes(cipherType);
      })
      .map((org) => org.id);
    return { cipherType, allowViewOrgIds };
  });
}

/**
 * Operator that waits until the active account has synced at least once before allowing the source to continue emission.
 * @param syncService
 */
const waitUntilSync = <T>(syncService: SyncService): MonoTypeOperatorFunction<T> => {
  return waitUntil(syncService.activeUserLastSync$().pipe(filter((lastSync) => lastSync != null)));
};
