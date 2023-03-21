import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";
import { firstValueFrom, Subject } from "rxjs";
import { first, switchMap, takeUntil } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { BroadcasterService } from "@bitwarden/common/abstractions/broadcaster.service";
import { CryptoService } from "@bitwarden/common/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { KdfType, DEFAULT_PBKDF2_ITERATIONS } from "@bitwarden/common/enums/kdfType";
import { ServiceUtils } from "@bitwarden/common/misc/serviceUtils";
import { TreeNode } from "@bitwarden/common/models/domain/tree-node";
import { Guid } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PasswordRepromptService } from "@bitwarden/common/vault/abstractions/password-reprompt.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { UpdateKeyComponent } from "../../settings/update-key.component";

import { AddEditComponent } from "./add-edit.component";
import { AttachmentsComponent } from "./attachments.component";
import { CollectionsComponent } from "./collections.component";
import { FolderAddEditComponent } from "./folder-add-edit.component";
import { ShareComponent } from "./share.component";
import { VaultFilterComponent } from "./vault-filter/components/vault-filter.component";
import { VaultFilterService } from "./vault-filter/services/abstractions/vault-filter.service";
import { RoutedVaultFilterBridgeService } from "./vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "./vault-filter/services/routed-vault-filter.service";
import { VaultFilter } from "./vault-filter/shared/models/vault-filter.model";
import { FolderFilter, OrganizationFilter } from "./vault-filter/shared/models/vault-filter.type";
import { VaultItemsComponent } from "./vault-items.component";

const BroadcasterSubscriptionId = "VaultComponent";

@Component({
  selector: "app-vault",
  templateUrl: "vault.component.html",
  providers: [RoutedVaultFilterService, RoutedVaultFilterBridgeService],
})
export class VaultComponent implements OnInit, OnDestroy {
  @ViewChild("vaultFilter", { static: true }) filterComponent: VaultFilterComponent;
  @ViewChild(VaultItemsComponent, { static: true }) vaultItemsComponent: VaultItemsComponent;
  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef;
  @ViewChild("folderAddEdit", { read: ViewContainerRef, static: true })
  folderAddEditModalRef: ViewContainerRef;
  @ViewChild("cipherAddEdit", { read: ViewContainerRef, static: true })
  cipherAddEditModalRef: ViewContainerRef;
  @ViewChild("share", { read: ViewContainerRef, static: true }) shareModalRef: ViewContainerRef;
  @ViewChild("collections", { read: ViewContainerRef, static: true })
  collectionsModalRef: ViewContainerRef;
  @ViewChild("updateKeyTemplate", { read: ViewContainerRef, static: true })
  updateKeyModalRef: ViewContainerRef;

  showVerifyEmail = false;
  showBrowserOutdated = false;
  showUpdateKey = false;
  showPremiumCallout = false;
  showLowKdf = false;
  trashCleanupWarning: string = null;
  kdfIterations: number;
  activeFilter: VaultFilter = new VaultFilter();
  private destroy$ = new Subject<void>();

  constructor(
    private syncService: SyncService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    private i18nService: I18nService,
    private modalService: ModalService,
    private tokenService: TokenService,
    private cryptoService: CryptoService,
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private stateService: StateService,
    private organizationService: OrganizationService,
    private vaultFilterService: VaultFilterService,
    private routedVaultFilterBridgeService: RoutedVaultFilterBridgeService,
    private cipherService: CipherService,
    private passwordRepromptService: PasswordRepromptService
  ) {}

  async ngOnInit() {
    this.showVerifyEmail = !(await this.tokenService.getEmailVerified());
    this.showBrowserOutdated = window.navigator.userAgent.indexOf("MSIE") !== -1;
    // disable warning for March release -> add await this.isLowKdfIteration(); when ready
    this.showLowKdf = false;
    this.trashCleanupWarning = this.i18nService.t(
      this.platformUtilsService.isSelfHost()
        ? "trashCleanupWarningSelfHosted"
        : "trashCleanupWarning"
    );

    this.route.queryParams
      .pipe(
        first(),
        switchMap(async (params: Params) => {
          await this.syncService.fullSync(false);
          await this.vaultFilterService.reloadCollections();
          await this.vaultItemsComponent.reload();

          const canAccessPremium = await this.stateService.getCanAccessPremium();
          this.showPremiumCallout =
            !this.showVerifyEmail && !canAccessPremium && !this.platformUtilsService.isSelfHost();
          this.showUpdateKey = !(await this.cryptoService.hasEncKey());

          const cipherId = getCipherIdFromParams(params);
          if (!cipherId) {
            return;
          }
          const cipherView = new CipherView();
          cipherView.id = cipherId;
          if (params.action === "clone") {
            await this.cloneCipher(cipherView);
          } else if (params.action === "edit") {
            await this.editCipher(cipherView);
          }
        }),
        switchMap(() => this.route.queryParams),
        switchMap(async (params) => {
          const cipherId = getCipherIdFromParams(params);
          if (cipherId) {
            if ((await this.cipherService.get(cipherId)) != null) {
              this.editCipherId(cipherId);
            } else {
              this.platformUtilsService.showToast(
                "error",
                this.i18nService.t("errorOccurred"),
                this.i18nService.t("unknownCipher")
              );
              this.router.navigate([], {
                queryParams: { itemId: null, cipherId: null },
                queryParamsHandling: "merge",
              });
            }
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              await Promise.all([
                this.vaultFilterService.reloadCollections(),
                this.vaultItemsComponent.load(this.vaultItemsComponent.filter),
              ]);
              this.changeDetectorRef.detectChanges();
            }
            break;
        }
      });
    });

    this.routedVaultFilterBridgeService.activeFilter$
      .pipe(takeUntil(this.destroy$))
      .subscribe((activeFilter) => {
        this.activeFilter = activeFilter;
      });
  }

  get isShowingCards() {
    return (
      this.showBrowserOutdated ||
      this.showPremiumCallout ||
      this.showUpdateKey ||
      this.showVerifyEmail ||
      this.showLowKdf
    );
  }

  emailVerified(verified: boolean) {
    this.showVerifyEmail = !verified;
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async applyOrganizationFilter(orgId: string) {
    if (orgId == null) {
      orgId = "MyVault";
    }
    const orgs = await firstValueFrom(this.filterComponent.filters.organizationFilter.data$);
    const orgNode = ServiceUtils.getTreeNodeObject(orgs, orgId) as TreeNode<OrganizationFilter>;
    this.filterComponent.filters?.organizationFilter?.action(orgNode);
  }

  addFolder = async (): Promise<void> => {
    const [modal] = await this.modalService.openViewRef(
      FolderAddEditComponent,
      this.folderAddEditModalRef,
      (comp) => {
        comp.folderId = null;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedFolder.subscribe(async () => {
          modal.close();
        });
      }
    );
  };

  editFolder = async (folder: FolderFilter): Promise<void> => {
    const [modal] = await this.modalService.openViewRef(
      FolderAddEditComponent,
      this.folderAddEditModalRef,
      (comp) => {
        comp.folderId = folder.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedFolder.subscribe(async () => {
          modal.close();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onDeletedFolder.subscribe(async () => {
          modal.close();
        });
      }
    );
  };

  filterSearchText(searchText: string) {
    this.vaultItemsComponent.searchText = searchText;
    this.vaultItemsComponent.search(200);
  }

  async editCipherAttachments(cipher: CipherView) {
    const canAccessPremium = await this.stateService.getCanAccessPremium();
    if (cipher.organizationId == null && !canAccessPremium) {
      this.messagingService.send("premiumRequired");
      return;
    } else if (cipher.organizationId != null) {
      const org = this.organizationService.get(cipher.organizationId);
      if (org != null && (org.maxStorageGb == null || org.maxStorageGb === 0)) {
        this.messagingService.send("upgradeOrganization", {
          organizationId: cipher.organizationId,
        });
        return;
      }
    }

    let madeAttachmentChanges = false;
    const [modal] = await this.modalService.openViewRef(
      AttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => {
        comp.cipherId = cipher.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onUploadedAttachment.subscribe(() => (madeAttachmentChanges = true));
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onDeletedAttachment.subscribe(() => (madeAttachmentChanges = true));
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onReuploadedAttachment.subscribe(() => (madeAttachmentChanges = true));
      }
    );

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    modal.onClosed.subscribe(async () => {
      if (madeAttachmentChanges) {
        await this.vaultItemsComponent.refresh();
      }
      madeAttachmentChanges = false;
    });
  }

  async shareCipher(cipher: CipherView) {
    const [modal] = await this.modalService.openViewRef(
      ShareComponent,
      this.shareModalRef,
      (comp) => {
        comp.cipherId = cipher.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSharedCipher.subscribe(async () => {
          modal.close();
          await this.vaultItemsComponent.refresh();
        });
      }
    );
  }

  async editCipherCollections(cipher: CipherView) {
    const [modal] = await this.modalService.openViewRef(
      CollectionsComponent,
      this.collectionsModalRef,
      (comp) => {
        comp.cipherId = cipher.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedCollections.subscribe(async () => {
          modal.close();
          await this.vaultItemsComponent.refresh();
        });
      }
    );
  }

  async addCipher() {
    const component = await this.editCipher(null);
    component.type = this.activeFilter.cipherType;
    if (this.activeFilter.organizationId !== "MyVault") {
      component.organizationId = this.activeFilter.organizationId as Guid;
      component.collections = (
        await firstValueFrom(this.vaultFilterService.filteredCollections$)
      ).filter((c) => !c.readOnly && c.id != null);
    }
    const selectedColId = this.activeFilter.collectionId;
    if (selectedColId !== "AllCollections") {
      component.collectionIds = [selectedColId as Guid];
    }
    component.folderId = this.activeFilter.folderId as Guid;
  }

  async navigateToCipher(cipher: CipherView) {
    this.go({ itemId: cipher?.id });
  }

  async editCipher(cipher: CipherView) {
    return this.editCipherId(cipher?.id);
  }

  async editCipherId(id: Guid) {
    const cipher = await this.cipherService.get(id);
    if (cipher != null && cipher.reprompt != 0) {
      if (!(await this.passwordRepromptService.showPasswordPrompt())) {
        this.go({ cipherId: null, itemId: null });
        return;
      }
    }

    const [modal, childComponent] = await this.modalService.openViewRef(
      AddEditComponent,
      this.cipherAddEditModalRef,
      (comp) => {
        comp.cipherId = id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedCipher.subscribe(async () => {
          modal.close();
          await this.vaultItemsComponent.refresh();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onDeletedCipher.subscribe(async () => {
          modal.close();
          await this.vaultItemsComponent.refresh();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onRestoredCipher.subscribe(async () => {
          modal.close();
          await this.vaultItemsComponent.refresh();
        });
      }
    );

    modal.onClosedPromise().then(() => {
      this.go({ cipherId: null, itemId: null });
    });

    return childComponent;
  }

  async cloneCipher(cipher: CipherView) {
    const component = await this.editCipher(cipher);
    component.cloneMode = true;
  }

  async updateKey() {
    await this.modalService.openViewRef(UpdateKeyComponent, this.updateKeyModalRef);
  }

  async isLowKdfIteration() {
    const kdfType = await this.stateService.getKdfType();
    const kdfOptions = await this.stateService.getKdfConfig();
    return kdfType === KdfType.PBKDF2_SHA256 && kdfOptions.iterations < DEFAULT_PBKDF2_ITERATIONS;
  }

  private go(queryParams: any = null) {
    if (queryParams == null) {
      queryParams = {
        favorites: this.activeFilter.isFavorites || null,
        type: this.activeFilter.cipherType,
        folderId: this.activeFilter.folderId,
        collectionId: this.activeFilter.collectionId,
        deleted: this.activeFilter.isDeleted || null,
      };
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
}

/**
 * Allows backwards compatibility with
 * old links that used the original `cipherId` param
 */
const getCipherIdFromParams = (params: Params): Guid => {
  return params["itemId"] || params["cipherId"];
};
