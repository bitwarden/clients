// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  firstValueFrom,
  map,
  of,
  switchMap,
} from "rxjs";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FilterService } from "@bitwarden/common/vault/search/filter.service";
import { ParseResult } from "@bitwarden/common/vault/search/query.types";

// eslint-disable-next-line no-restricted-imports -- TODO: this needs to go
import { CollectionService } from "../../../../admin-console/src/common/collections";

@Directive()
export class VaultItemsComponent implements OnInit, OnDestroy {
  @Input() activeCipherId: string = null;
  @Output() onCipherClicked = new EventEmitter<CipherView>();
  @Output() onCipherRightClicked = new EventEmitter<CipherView>();
  @Output() onAddCipher = new EventEmitter();
  @Output() onAddCipherOptions = new EventEmitter();

  loaded = false;
  ciphers: CipherView[] = [];
  filter: (cipher: CipherView) => boolean = null;
  deleted = false;
  organization: Organization;

  protected searchPending = false;

  private userId: UserId;
  private destroy$ = new Subject<void>();
  private searchTimeout: any = null;
  private isSearchable: boolean = false;
  private parsedFilter$: Observable<ParseResult>;
  private _searchText$ = new BehaviorSubject<string>("");
  get searchText() {
    return this._searchText$.value;
  }
  set searchText(value: string) {
    this._searchText$.next(value);
  }

  constructor(
    protected filterService: FilterService,
    protected searchService: SearchService,
    protected cipherService: CipherService,
    protected folderService: FolderService,
    protected organizationService: OrganizationService,
    protected collectionService: CollectionService,
    protected accountService: AccountService,
  ) {}

  async ngOnInit() {
    this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const parsedFilter$ = this.filterService.parse(this._searchText$).pipe(takeUntilDestroyed());

    parsedFilter$.subscribe(({ isError }) => {
      this.isSearchable = !isError;
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
    await this.search(null);
  }

  async search(timeout: number = null, indexedCiphers?: CipherView[]) {
    this.searchPending = false;
    if (this.searchTimeout != null) {
      clearTimeout(this.searchTimeout);
    }
    if (timeout == null) {
      await this.doSearch(indexedCiphers);
      return;
    }
    this.searchPending = true;
    this.searchTimeout = setTimeout(async () => {
      await this.doSearch(indexedCiphers);
      this.searchPending = false;
    }, timeout);
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

  protected async doSearch(indexedCiphers?: CipherView[], userId?: UserId) {
    // Get userId from activeAccount if not provided from parent stream
    if (!userId) {
      userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    }

    indexedCiphers =
      indexedCiphers ?? (await firstValueFrom(this.cipherService.cipherViews$(userId)));

    const failedCiphers = await firstValueFrom(this.cipherService.failedToDecryptCiphers$(userId));
    if (failedCiphers != null && failedCiphers.length > 0) {
      indexedCiphers = [...failedCiphers, ...indexedCiphers];
    }

    const context$ = this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        return this.filterService.context$({
          ciphers: this.cipherService.cipherViews$(account.id),
          folders: this.folderService.folderViews$(account.id),
          collections: this.collectionService.decryptedCollections$,
          organizations: this.organizationService.organizations$(account.id),
        });
      }),
    );

    const ciphers$ = combineLatest([this.parsedFilter$, context$]).pipe(
      switchMap(([parsedFilter, context]) => {
        return this.filterService.filter(of([parsedFilter, context]));
      }),
      // this.filterService.filter,
      switchMap((result) => {
        if (result.isError) {
          // return all ciphers
          return context$.pipe(map((c) => c.ciphers));
        } else {
          // return filtered ciphers
          return of(result.ciphers);
        }
      }),
    );

    this.ciphers = await firstValueFrom(ciphers$);
  }
}
