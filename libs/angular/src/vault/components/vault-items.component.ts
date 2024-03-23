import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { Directive, EventEmitter, Input, Output, ViewChild } from "@angular/core";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

@Directive()
export class VaultItemsComponent {
  @Input() activeCipherId: string = null;
  @Output() onCipherClicked = new EventEmitter<CipherView>();
  @Output() onCipherRightClicked = new EventEmitter<CipherView>();
  @Output() onAddCipher = new EventEmitter();
  @Output() onAddCipherOptions = new EventEmitter();
  @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;

  loaded = false;
  ciphers: CipherView[] = [];
  searchPlaceholder: string = null;
  filter: (cipher: CipherView) => boolean = null;
  deleted = false;
  organization: Organization;
  accessEvents = false;

  protected searchPending = false;

  private searchTimeout: any = null;
  private _searchText: string = null;
  get searchText() {
    return this._searchText;
  }
  set searchText(value: string) {
    this._searchText = value;
  }

  constructor(
    protected searchService: SearchService,
    protected cipherService: CipherService,
  ) {}

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
    const scrollPosition = this.viewport?.measureScrollOffset("top");
    await this.reload(this.filter, this.deleted);
    if (scrollPosition > 0) {
      // this is a workaround to prevent the ViewChild viewport from being undefined.
      setTimeout(() => {
        this.viewport?.scrollToOffset(scrollPosition);
      });
    }
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
    return !this.searchPending && this.searchService.isSearchable(this.searchText);
  }

  protected deletedFilter: (cipher: CipherView) => boolean = (c) => c.isDeleted === this.deleted;

  protected async doSearch(indexedCiphers?: CipherView[]) {
    indexedCiphers = indexedCiphers ?? (await this.cipherService.getAllDecrypted());
    this.ciphers = await this.searchService.searchCiphers(
      this.searchText,
      [this.filter, this.deletedFilter],
      indexedCiphers,
    );
  }
}
