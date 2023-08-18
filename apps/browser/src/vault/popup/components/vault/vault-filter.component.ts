import { Location } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { BrowserGroupingsComponentState } from "../../../../models/browserGroupingsComponentState";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import { BrowserStateService } from "../../../../platform/services/abstractions/browser-state.service";
import { NavigatableListComponent } from "../../../../popup/components/navigatable-list.component";
import { PopupUtilsService } from "../../../../popup/services/popup-utils.service";
import { VaultFilterService } from "../../../services/vault-filter.service";

const ComponentId = "VaultComponent";

@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
})
export class VaultFilterComponent implements OnInit, OnDestroy {
  get showNoFolderCiphers(): boolean {
    return (
      this.noFolderCiphers != null &&
      this.noFolderCiphers.length < this.noFolderListSize &&
      this.collections.length === 0
    );
  }

  get folderCount(): number {
    return this.nestedFolders.length - (this.showNoFolderCiphers ? 0 : 1);
  }
  folders: FolderView[];
  nestedFolders: TreeNode<FolderView>[];
  collections: CollectionView[];
  nestedCollections: TreeNode<CollectionView>[];
  loaded = false;
  cipherType = CipherType;
  ciphers: CipherView[];
  favoriteCiphers: CipherView[];
  noFolderCiphers: CipherView[];
  folderCounts = new Map<string, number>();
  collectionCounts = new Map<string, number>();
  typeCounts = new Map<CipherType, number>();
  searchText: string;
  state: BrowserGroupingsComponentState;
  showLeftHeader = true;
  searchPending = false;
  searchTypeSearch = false;
  deletedCount = 0;
  vaultFilter: VaultFilter;
  selectedOrganization: string = null;
  showCollections = true;

  private loadedTimeout: number;
  private selectedTimeout: number;
  private preventSelected = false;
  private noFolderListSize = 100;
  private searchTimeout: any = null;
  private hasSearched = false;
  private hasLoadedAllCiphers = false;
  private allCiphers: CipherView[] = null;

  @ViewChild(NavigatableListComponent) navigatableListComponent: NavigatableListComponent;

  constructor(
    private i18nService: I18nService,
    private cipherService: CipherService,
    private router: Router,
    private ngZone: NgZone,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private popupUtils: PopupUtilsService,
    private syncService: SyncService,
    private platformUtilsService: PlatformUtilsService,
    private searchService: SearchService,
    private location: Location,
    private browserStateService: BrowserStateService,
    private vaultFilterService: VaultFilterService,
    private element: ElementRef
  ) {
    this.noFolderListSize = 100;
  }

  async ngOnInit() {
    this.searchTypeSearch = !this.platformUtilsService.isSafari();
    this.showLeftHeader = !(
      this.popupUtils.inSidebar(window) && this.platformUtilsService.isFirefox()
    );
    await this.browserStateService.setBrowserVaultItemsComponentState(null);

    this.broadcasterService.subscribe(ComponentId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            window.setTimeout(() => {
              this.load();
            }, 500);
            break;
          default:
            break;
        }

        this.changeDetectorRef.detectChanges();
      });
    });

    const restoredScopeState = await this.restoreState();
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      this.state = await this.browserStateService.getBrowserGroupingComponentState();
      if (this.state?.searchText) {
        this.searchText = this.state.searchText;
      } else if (params.searchText) {
        this.searchText = params.searchText;
        this.location.replaceState("vault");
      }

      if (!this.syncService.syncInProgress) {
        this.load();
      } else {
        this.loadedTimeout = window.setTimeout(() => {
          if (!this.loaded) {
            this.load();
          }
        }, 5000);
      }

      if (!this.syncService.syncInProgress || restoredScopeState) {
        window.setTimeout(() => this.popupUtils.setContentScrollY(window, this.state?.scrollY), 0);
      }
    });
  }

  ngOnDestroy() {
    if (this.loadedTimeout != null) {
      window.clearTimeout(this.loadedTimeout);
    }
    if (this.selectedTimeout != null) {
      window.clearTimeout(this.selectedTimeout);
    }
    this.saveState();
    this.broadcasterService.unsubscribe(ComponentId);
  }

  async load() {
    this.vaultFilter = this.vaultFilterService.getVaultFilter();

    this.updateSelectedOrg();
    await this.loadCollectionsAndFolders();
    await this.loadCiphers();

    if (this.showNoFolderCiphers && this.nestedFolders.length > 0) {
      // Remove "No Folder" from folder listing
      this.nestedFolders = this.nestedFolders.slice(0, this.nestedFolders.length - 1);
    }

    this.loaded = true;
  }

  async loadCiphers() {
    this.allCiphers = await this.cipherService.getAllDecrypted();
    if (!this.hasLoadedAllCiphers) {
      this.hasLoadedAllCiphers = !this.searchService.isSearchable(this.searchText);
    }
    await this.search(null);
    this.getCounts();
  }

  async loadCollections() {
    const allCollections = await this.vaultFilterService.buildCollections(
      this.selectedOrganization
    );
    this.collections = allCollections.fullList;
    this.nestedCollections = allCollections.nestedList;
  }

  async loadFolders() {
    const allFolders = await firstValueFrom(
      this.vaultFilterService.buildNestedFolders(this.selectedOrganization)
    );
    this.folders = allFolders.fullList;
    this.nestedFolders = allFolders.nestedList;
  }

  async search(timeout: number = null) {
    this.searchPending = false;
    if (this.searchTimeout != null) {
      clearTimeout(this.searchTimeout);
    }
    const filterDeleted = (c: CipherView) => !c.isDeleted;
    if (timeout == null) {
      this.hasSearched = this.searchService.isSearchable(this.searchText);
      this.ciphers = await this.searchService.searchCiphers(
        this.searchText,
        filterDeleted,
        this.allCiphers
      );
      this.ciphers = this.ciphers.filter(
        (c) => !this.vaultFilterService.filterCipherForSelectedVault(c)
      );
      return;
    }
    this.searchPending = true;
    this.searchTimeout = setTimeout(async () => {
      this.hasSearched = this.searchService.isSearchable(this.searchText);
      if (!this.hasLoadedAllCiphers && !this.hasSearched) {
        await this.loadCiphers();
      } else {
        this.ciphers = await this.searchService.searchCiphers(
          this.searchText,
          filterDeleted,
          this.allCiphers
        );
      }
      this.ciphers = this.ciphers.filter(
        (c) => !this.vaultFilterService.filterCipherForSelectedVault(c)
      );
      this.searchPending = false;
    }, timeout);
  }

  async selectType(type: CipherType) {
    this.router.navigate(["/ciphers"], { queryParams: { type: type } });
  }

  async selectFolder(folder: FolderView) {
    this.router.navigate(["/ciphers"], { queryParams: { folderId: folder.id || "none" } });
  }

  async selectCollection(collection: CollectionView) {
    this.router.navigate(["/ciphers"], { queryParams: { collectionId: collection.id } });
  }

  async selectTrash() {
    this.router.navigate(["/ciphers"], { queryParams: { deleted: true } });
  }

  async selectCipher(cipher: CipherView) {
    this.selectedTimeout = window.setTimeout(() => {
      if (!this.preventSelected) {
        this.router.navigate(["/view-cipher"], { queryParams: { cipherId: cipher.id } });
      }
      this.preventSelected = false;
    }, 200);
  }

  async launchCipher(cipher: CipherView) {
    if (cipher.type !== CipherType.Login || !cipher.login.canLaunch) {
      return;
    }

    if (this.selectedTimeout != null) {
      window.clearTimeout(this.selectedTimeout);
    }
    this.preventSelected = true;
    await this.cipherService.updateLastLaunchedDate(cipher.id);
    BrowserApi.createNewTab(cipher.login.launchUri);
    if (this.popupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  async addCipher() {
    this.router.navigate(["/add-cipher"], {
      queryParams: { selectedVault: this.vaultFilter.selectedOrganizationId },
    });
  }

  async vaultFilterChanged() {
    if (this.showSearching) {
      await this.search();
    }
    this.updateSelectedOrg();
    await this.loadCollectionsAndFolders();
    this.getCounts();
  }

  updateSelectedOrg() {
    this.vaultFilter = this.vaultFilterService.getVaultFilter();
    if (this.vaultFilter.selectedOrganizationId != null) {
      this.selectedOrganization = this.vaultFilter.selectedOrganizationId;
    } else {
      this.selectedOrganization = null;
    }
  }

  getCounts() {
    let favoriteCiphers: CipherView[] = null;
    let noFolderCiphers: CipherView[] = null;
    const folderCounts = new Map<string, number>();
    const collectionCounts = new Map<string, number>();
    const typeCounts = new Map<CipherType, number>();

    this.deletedCount = this.allCiphers.filter(
      (c) => c.isDeleted && !this.vaultFilterService.filterCipherForSelectedVault(c)
    ).length;

    this.ciphers?.forEach((c) => {
      if (!this.vaultFilterService.filterCipherForSelectedVault(c)) {
        if (c.isDeleted) {
          return;
        }
        if (c.favorite) {
          if (favoriteCiphers == null) {
            favoriteCiphers = [];
          }
          favoriteCiphers.push(c);
        }

        if (c.folderId == null) {
          if (noFolderCiphers == null) {
            noFolderCiphers = [];
          }
          noFolderCiphers.push(c);
        }

        if (typeCounts.has(c.type)) {
          typeCounts.set(c.type, typeCounts.get(c.type) + 1);
        } else {
          typeCounts.set(c.type, 1);
        }

        if (folderCounts.has(c.folderId)) {
          folderCounts.set(c.folderId, folderCounts.get(c.folderId) + 1);
        } else {
          folderCounts.set(c.folderId, 1);
        }

        if (c.collectionIds != null) {
          c.collectionIds.forEach((colId) => {
            if (collectionCounts.has(colId)) {
              collectionCounts.set(colId, collectionCounts.get(colId) + 1);
            } else {
              collectionCounts.set(colId, 1);
            }
          });
        }
      }
    });

    this.favoriteCiphers = favoriteCiphers;
    this.noFolderCiphers = noFolderCiphers;
    this.typeCounts = typeCounts;
    this.folderCounts = folderCounts;
    this.collectionCounts = collectionCounts;
  }

  showSearching() {
    return (
      this.hasSearched || (!this.searchPending && this.searchService.isSearchable(this.searchText))
    );
  }

  closeOnEsc(e: KeyboardEvent) {
    // If input not empty, use browser default behavior of clearing input instead
    if (e.key === "Escape" && (this.searchText == null || this.searchText === "")) {
      BrowserApi.closePopup(window);
    }
  }

  private async loadCollectionsAndFolders() {
    this.showCollections = !this.vaultFilter.myVaultOnly;
    await this.loadFolders();
    await this.loadCollections();
  }

  private async saveState() {
    this.state = Object.assign(new BrowserGroupingsComponentState(), {
      scrollY: this.popupUtils.getContentScrollY(window),
      searchText: this.searchText,
      favoriteCiphers: this.favoriteCiphers,
      noFolderCiphers: this.noFolderCiphers,
      ciphers: this.ciphers,
      collectionCounts: this.collectionCounts,
      folderCounts: this.folderCounts,
      typeCounts: this.typeCounts,
      folders: this.folders,
      collections: this.collections,
      deletedCount: this.deletedCount,
    });
    await this.browserStateService.setBrowserGroupingComponentState(this.state);
  }

  private async restoreState(): Promise<boolean> {
    this.state = await this.browserStateService.getBrowserGroupingComponentState();
    if (this.state == null) {
      return false;
    }

    if (this.state.favoriteCiphers != null) {
      this.favoriteCiphers = this.state.favoriteCiphers;
    }
    if (this.state.noFolderCiphers != null) {
      this.noFolderCiphers = this.state.noFolderCiphers;
    }
    if (this.state.ciphers != null) {
      this.ciphers = this.state.ciphers;
    }
    if (this.state.collectionCounts != null) {
      this.collectionCounts = this.state.collectionCounts;
    }
    if (this.state.folderCounts != null) {
      this.folderCounts = this.state.folderCounts;
    }
    if (this.state.typeCounts != null) {
      this.typeCounts = this.state.typeCounts;
    }
    if (this.state.folders != null) {
      this.folders = this.state.folders;
    }
    if (this.state.collections != null) {
      this.collections = this.state.collections;
    }
    if (this.state.deletedCount != null) {
      this.deletedCount = this.state.deletedCount;
    }

    return true;
  }

  @HostListener("keydown", ["$event"])
  onKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" && !this.navigatableListComponent.isFocused()) {
      this.navigatableListComponent.focusTop();
      event.preventDefault();
    } else if (event.ctrlKey && event.key === "f") {
      this.element.nativeElement.querySelector("#search").focus();
      event.preventDefault();
    }
  }
}
