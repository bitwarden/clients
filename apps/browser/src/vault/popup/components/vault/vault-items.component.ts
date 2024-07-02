import { Location } from "@angular/common";
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { VaultItemsComponent as BaseVaultItemsComponent } from "@bitwarden/angular/vault/components/vault-items.component";
import { VaultFilter } from "@bitwarden/angular/vault/vault-filter/models/vault-filter.model";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { BrowserComponentState } from "../../../../models/browserComponentState";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/popup/browser-popup-utils";
import { VaultBrowserStateService } from "../../../services/vault-browser-state.service";
import { VaultFilterService } from "../../../services/vault-filter.service";

const ComponentId = "VaultItemsComponent";

@Component({
  selector: "app-vault-items",
  templateUrl: "vault-items.component.html",
})
export class VaultItemsComponent extends BaseVaultItemsComponent implements OnInit, OnDestroy {
  groupingTitle: string;
  state: BrowserComponentState;
  folderId: string = null;
  collectionId: string = null;
  type: CipherType = null;
  nestedFolders: TreeNode<FolderView>[];
  nestedCollections: TreeNode<CollectionView>[];
  searchTypeSearch = false;
  showOrganizations = false;
  vaultFilter: VaultFilter;
  deleted = true;
  noneFolder = false;
  showVaultFilter = false;

  private selectedTimeout: number;
  private preventSelected = false;
  private applySavedState = true;
  private scrollingContainer = "cdk-virtual-scroll-viewport";

  constructor(
    searchService: SearchService,
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private ngZone: NgZone,
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private stateService: VaultBrowserStateService,
    private i18nService: I18nService,
    private collectionService: CollectionService,
    private platformUtilsService: PlatformUtilsService,
    cipherService: CipherService,
    private vaultFilterService: VaultFilterService,
  ) {
    super(searchService, cipherService);
    this.applySavedState =
      (window as any).previousPopupUrl != null &&
      !(window as any).previousPopupUrl.startsWith("/ciphers");
  }

  async ngOnInit() {
    this.searchTypeSearch = !this.platformUtilsService.isSafari();
    this.showOrganizations = await this.organizationService.hasOrganizations();
    this.vaultFilter = this.vaultFilterService.getVaultFilter();
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      if (this.applySavedState) {
        this.state = await this.stateService.getBrowserVaultItemsComponentState();
        if (this.state?.searchText) {
          this.searchText = this.state.searchText;
        }
      }

      if (params.deleted) {
        this.showVaultFilter = true;
        this.groupingTitle = this.i18nService.t("trash");
        this.searchPlaceholder = this.i18nService.t("searchTrash");
        await this.load(this.buildFilter(), true);
      } else if (params.type) {
        this.showVaultFilter = true;
        this.searchPlaceholder = this.i18nService.t("searchType");
        this.type = parseInt(params.type, null);
        switch (this.type) {
          case CipherType.Login:
            this.groupingTitle = this.i18nService.t("logins");
            break;
          case CipherType.Card:
            this.groupingTitle = this.i18nService.t("cards");
            break;
          case CipherType.Identity:
            this.groupingTitle = this.i18nService.t("identities");
            break;
          case CipherType.SecureNote:
            this.groupingTitle = this.i18nService.t("secureNotes");
            break;
          default:
            break;
        }
        await this.load(this.buildFilter());
      } else if (params.folderId) {
        this.showVaultFilter = true;
        this.folderId = params.folderId === "none" ? null : params.folderId;
        this.searchPlaceholder = this.i18nService.t("searchFolder");
        if (this.folderId != null) {
          this.showOrganizations = false;
          const folderNode = await this.vaultFilterService.getFolderNested(this.folderId);
          if (folderNode != null && folderNode.node != null) {
            this.groupingTitle = folderNode.node.name;
            this.nestedFolders =
              folderNode.children != null && folderNode.children.length > 0
                ? folderNode.children
                : null;
          }
        } else {
          this.noneFolder = true;
          this.groupingTitle = this.i18nService.t("noneFolder");
        }
        await this.load(this.buildFilter());
      } else if (params.collectionId) {
        this.showVaultFilter = false;
        this.collectionId = params.collectionId;
        this.searchPlaceholder = this.i18nService.t("searchCollection");
        const collectionNode = await this.collectionService.getNested(this.collectionId);
        if (collectionNode != null && collectionNode.node != null) {
          this.groupingTitle = collectionNode.node.name;
          this.nestedCollections =
            collectionNode.children != null && collectionNode.children.length > 0
              ? collectionNode.children
              : null;
        }
        await this.load(
          (c) => c.collectionIds != null && c.collectionIds.indexOf(this.collectionId) > -1,
        );
      } else {
        this.showVaultFilter = true;
        this.groupingTitle = this.i18nService.t("allItems");
        await this.load(this.buildFilter());
      }

      if (this.applySavedState && this.state != null) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        BrowserPopupUtils.setContentScrollY(window, this.state.scrollY, {
          delay: 0,
          containerSelector: this.scrollingContainer,
        });
      }
      await this.stateService.setBrowserVaultItemsComponentState(null);
    });

    this.broadcasterService.subscribe(ComponentId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              window.setTimeout(() => {
                // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.refresh();
              }, 500);
            }
            break;
          default:
            break;
        }

        this.changeDetectorRef.detectChanges();
      });
    });
  }

  ngOnDestroy() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.saveState();
    this.broadcasterService.unsubscribe(ComponentId);
  }

  selectCipher(cipher: CipherView) {
    this.selectedTimeout = window.setTimeout(() => {
      if (!this.preventSelected) {
        super.selectCipher(cipher);
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/view-cipher"], {
          queryParams: { cipherId: cipher.id },
        });
      }
      this.preventSelected = false;
    }, 200);
  }

  selectFolder(folder: FolderView) {
    if (folder.id != null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/ciphers"], { queryParams: { folderId: folder.id } });
    }
  }

  selectCollection(collection: CollectionView) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/ciphers"], { queryParams: { collectionId: collection.id } });
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
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    BrowserApi.createNewTab(cipher.login.launchUri);
    if (BrowserPopupUtils.inPopup(window)) {
      BrowserApi.closePopup(window);
    }
  }

  addCipher() {
    if (this.deleted) {
      return false;
    }
    super.addCipher();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/add-cipher"], {
      queryParams: {
        folderId: this.folderId,
        type: this.type,
        collectionId: this.collectionId,
        selectedVault: this.vaultFilter.selectedOrganizationId,
      },
    });
  }

  back() {
    (window as any).routeDirection = "b";
    this.location.back();
  }

  showGroupings() {
    return (
      !this.isSearching() &&
      ((this.nestedFolders && this.nestedFolders.length) ||
        (this.nestedCollections && this.nestedCollections.length))
    );
  }

  async changeVaultSelection() {
    this.vaultFilter = this.vaultFilterService.getVaultFilter();
    await this.load(this.buildFilter(), this.deleted);
  }

  private buildFilter(): (cipher: CipherView) => boolean {
    return (cipher) => {
      let cipherPassesFilter = true;
      if (this.deleted && cipherPassesFilter) {
        cipherPassesFilter = cipher.isDeleted;
      }
      if (this.type != null && cipherPassesFilter) {
        cipherPassesFilter = cipher.type === this.type;
      }
      if (this.folderId != null && this.folderId != "none" && cipherPassesFilter) {
        cipherPassesFilter = cipher.folderId === this.folderId;
      }
      if (this.noneFolder) {
        cipherPassesFilter = cipher.folderId == null;
      }
      if (this.collectionId != null && cipherPassesFilter) {
        cipherPassesFilter =
          cipher.collectionIds != null && cipher.collectionIds.indexOf(this.collectionId) > -1;
      }
      if (this.vaultFilter.selectedOrganizationId != null && cipherPassesFilter) {
        cipherPassesFilter = cipher.organizationId === this.vaultFilter.selectedOrganizationId;
      }
      if (this.vaultFilter.myVaultOnly && cipherPassesFilter) {
        cipherPassesFilter = cipher.organizationId === null;
      }
      return cipherPassesFilter;
    };
  }

  private async saveState() {
    this.state = {
      scrollY: BrowserPopupUtils.getContentScrollY(window, this.scrollingContainer),
      searchText: this.searchText,
    };
    await this.stateService.setBrowserVaultItemsComponentState(this.state);
  }
}
