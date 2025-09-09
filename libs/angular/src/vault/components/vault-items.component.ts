// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  filter,
  map,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

@Directive()
export class VaultItemsComponent<C extends CipherViewLike> implements OnDestroy {
  @Input() activeCipherId: string = null;
  @Output() onCipherClicked = new EventEmitter<C>();
  @Output() onCipherRightClicked = new EventEmitter<C>();
  @Output() onAddCipher = new EventEmitter<CipherType | undefined>();
  @Output() onAddCipherOptions = new EventEmitter();

  loaded = false;
  ciphers: C[] = [];
  deleted = false;
  organization: Organization;
  CipherType = CipherType;

  protected itemTypes$ = this.restrictedItemTypesService.restricted$.pipe(
    map((restrictedItemTypes) =>
      // Filter out restricted item types
      CIPHER_MENU_ITEMS.filter(
        (itemType) =>
          !restrictedItemTypes.some(
            (restrictedType) => restrictedType.cipherType === itemType.type,
          ),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Construct filters as an observable so it can be appended to the cipher stream. */
  private _filter$ = new BehaviorSubject<(cipher: C) => boolean | null>(null);
  private destroy$ = new Subject<void>();
  private _searchText$ = new BehaviorSubject<string>("");

  get searchText() {
    return this._searchText$.value;
  }
  set searchText(value: string) {
    this._searchText$.next(value);
  }

  get filter() {
    return this._filter$.value;
  }

  set filter(value: (cipher: C) => boolean | null) {
    this._filter$.next(value);
  }

  constructor(
    protected searchService: SearchService,
    protected cipherService: CipherService,
    protected accountService: AccountService,
    protected restrictedItemTypesService: RestrictedItemTypesService,
  ) {
    this.subscribeToCiphers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load(filter: (cipher: C) => boolean = null, deleted = false) {
    this.deleted = deleted ?? false;
    await this.applyFilter(filter);
    this.loaded = true;
  }

  async reload(filter: (cipher: C) => boolean = null, deleted = false) {
    this.loaded = false;
    await this.load(filter, deleted);
  }

  async refresh() {
    await this.reload(this.filter, this.deleted);
  }

  async applyFilter(filter: (cipher: C) => boolean = null) {
    this.filter = filter;
  }

  selectCipher(cipher: C) {
    this.onCipherClicked.emit(cipher);
  }

  rightClickCipher(cipher: C) {
    this.onCipherRightClicked.emit(cipher);
  }

  addCipher(type?: CipherType) {
    this.onAddCipher.emit(type);
  }

  addCipherOptions() {
    this.onAddCipherOptions.emit();
  }

  protected deletedFilter: (cipher: C) => boolean = (c) =>
    CipherViewLikeUtils.isDeleted(c) === this.deleted;

  /**
   * Creates stream of dependencies that results in the list of ciphers to display
   * within the vault list.
   *
   * Note: This previously used promises but race conditions with how the ciphers were
   * stored in electron. Using observables is more reliable as fresh values will always
   * cascade through the components.
   */
  private subscribeToCiphers() {
    getUserId(this.accountService.activeAccount$)
      .pipe(
        switchMap((userId) =>
          combineLatest([
            this.cipherService.cipherListViews$(userId).pipe(filter((ciphers) => ciphers != null)),
            this.cipherService.failedToDecryptCiphers$(userId),
            this._searchText$,
            this._filter$,
            of(userId),
            this.restrictedItemTypesService.restricted$,
          ]),
        ),
        switchMap(([indexedCiphers, failedCiphers, searchText, filter, userId, restricted]) => {
          let allCiphers = (indexedCiphers ?? []) as C[];
          const _failedCiphers = failedCiphers ?? [];

          allCiphers = [..._failedCiphers, ...allCiphers] as C[];

          const restrictedTypeFilter = (cipher: CipherViewLike) =>
            !this.restrictedItemTypesService.isCipherRestricted(cipher, restricted);

          return this.searchService.searchCiphers(
            userId,
            searchText,
            [filter, this.deletedFilter, restrictedTypeFilter],
            allCiphers,
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((ciphers) => {
        this.ciphers = ciphers;
        this.loaded = true;
      });
  }
}
