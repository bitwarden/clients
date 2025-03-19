// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  filter,
  firstValueFrom,
  from,
  switchMap,
  takeUntil,
} from "rxjs";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

@Directive()
export class VaultItemsComponent implements OnInit, OnDestroy {
  @Input() activeCipherId: string = null;
  @Output() onCipherClicked = new EventEmitter<CipherView>();
  @Output() onCipherRightClicked = new EventEmitter<CipherView>();
  @Output() onAddCipher = new EventEmitter();
  @Output() onAddCipherOptions = new EventEmitter();

  loaded = false;
  ciphers: CipherView[] = [];
  deleted = false;
  organization: Organization;

  protected searchPending = false;

  /** Construct filters as an observable so it can be appended to the cipher stream. */
  private _filter$ = new BehaviorSubject<(cipher: CipherView) => boolean | null>(null);
  private userId: UserId;
  private destroy$ = new Subject<void>();
  private isSearchable: boolean = false;
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

  set filter(value: (cipher: CipherView) => boolean | null) {
    this._filter$.next(value);
  }

  constructor(
    protected searchService: SearchService,
    protected cipherService: CipherService,
    protected accountService: AccountService,
  ) {
    this.subscribeToCiphers();
  }

  async ngOnInit() {
    this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    this._searchText$
      .pipe(
        switchMap((searchText) => from(this.searchService.isSearchable(this.userId, searchText))),
        takeUntil(this.destroy$),
      )
      .subscribe((isSearchable) => {
        this.isSearchable = isSearchable;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load(filter: (cipher: CipherView) => boolean = null, deleted = false) {
    this.deleted = deleted ?? false;
    await this.applyFilter(filter);
    this.loaded = true;
  }

  async reload(filter: (cipher: CipherView) => boolean = null, deleted = false) {
    this.loaded = false;
    await this.load(filter, deleted);
  }

  async refresh() {
    await this.reload(this.filter, this.deleted);
  }

  async applyFilter(filter: (cipher: CipherView) => boolean = null) {
    this.filter = filter;
  }

  selectCipher(cipher: CipherView) {
    this.onCipherClicked.emit(cipher);
  }

  rightClickCipher(cipher: CipherView) {
    this.onCipherRightClicked.emit(cipher);
  }

  addCipher() {
    this.onAddCipher.emit();
  }

  addCipherOptions() {
    this.onAddCipherOptions.emit();
  }

  isSearching() {
    return !this.searchPending && this.isSearchable;
  }

  protected deletedFilter: (cipher: CipherView) => boolean = (c) => c.isDeleted === this.deleted;

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
            this.cipherService.cipherViews$(userId).pipe(filter((ciphers) => ciphers != null)),
            this.cipherService.failedToDecryptCiphers$(userId),
            this._searchText$,
            this._filter$,
          ]),
        ),
        switchMap(([indexedCiphers, failedCiphers, searchText, filter]) => {
          let allCiphers = indexedCiphers ?? [];
          const _failedCiphers = failedCiphers ?? [];

          allCiphers = [..._failedCiphers, ...allCiphers];

          return this.searchService.searchCiphers(
            this.userId,
            searchText,
            [filter, this.deletedFilter],
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
