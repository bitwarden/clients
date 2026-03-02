import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { VaultViewPasswordHistoryService } from "@bitwarden/angular/services/view-password-history.service";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  CopyClickListener,
  COPY_CLICK_LISTENER,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  IconButtonModule,
  ItemModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  AttachmentsV2Component,
  ChangeLoginPasswordService,
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormGenerationService,
  CipherFormModule,
  CipherViewComponent,
  DefaultChangeLoginPasswordService,
  DefaultCipherFormConfigService,
  DefaultVaultItemsTransferService,
  VaultItemsTransferService,
} from "@bitwarden/vault";

import { DesktopCredentialGenerationService } from "../../../services/desktop-cipher-form-generator.service";
import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";

export interface VaultItemDrawerParams {
  mode: "view" | "add" | "edit" | "clone";
  cipherId?: CipherId;
  cipherType?: CipherType;
  initialValues?: {
    folderId?: string;
    organizationId?: OrganizationId;
    collectionIds?: CollectionId[];
  };
  allCollections: CollectionView[];
}

export const VaultItemDrawerResult = Object.freeze({
  Saved: "saved",
  Deleted: "deleted",
} as const);

export type VaultItemDrawerResult =
  (typeof VaultItemDrawerResult)[keyof typeof VaultItemDrawerResult];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-item-drawer",
  templateUrl: "vault-item-drawer.component.html",
  imports: [
    ButtonModule,
    DialogModule,
    CipherViewComponent,
    CipherFormModule,
    IconButtonModule,
    ItemModule,
    PremiumBadgeComponent,
    I18nPipe,
  ],
  providers: [
    { provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService },
    { provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService },
    { provide: ViewPasswordHistoryService, useClass: VaultViewPasswordHistoryService },
    { provide: PremiumUpgradePromptService, useClass: DesktopPremiumUpgradePromptService },
    { provide: CipherFormGenerationService, useClass: DesktopCredentialGenerationService },
    { provide: VaultItemsTransferService, useClass: DefaultVaultItemsTransferService },
    { provide: COPY_CLICK_LISTENER, useExisting: VaultItemDrawerComponent },
  ],
})
export class VaultItemDrawerComponent implements CopyClickListener, OnInit {
  protected params = inject<VaultItemDrawerParams>(DIALOG_DATA);
  private dialogRef = inject<DialogRef<VaultItemDrawerResult>>(DialogRef);
  private messagingService = inject(MessagingService);
  private cipherService = inject(CipherService);
  private accountService = inject(AccountService);
  private formConfigService = inject(CipherFormConfigService);
  private dialogService = inject(DialogService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private logService = inject(LogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);

  protected readonly action = signal<"view" | "add" | "edit" | "clone">(this.params.mode);
  protected readonly cipher = signal<CipherView | null>(null);
  protected readonly config = signal<CipherFormConfig | null>(null);
  protected readonly collections = signal<CollectionView[]>([]);
  protected readonly formDisabled = signal(false);

  protected readonly title = computed(() => {
    const action = this.action();
    const type = this.cipher()?.type ?? this.params.cipherType;
    const typeSuffix: Record<CipherType, string> = {
      [CipherType.Login]: "Login",
      [CipherType.Card]: "Card",
      [CipherType.Identity]: "Identity",
      [CipherType.SecureNote]: "Note",
      [CipherType.SshKey]: "SshKey",
    };
    const suffix = type != null ? typeSuffix[type] : null;
    if (action === "add" || action === "clone") {
      return this.i18nService.t(suffix ? `newItemHeader${suffix}` : "newItem");
    }
    if (action === "edit") {
      return this.i18nService.t(suffix ? `editItemHeader${suffix}` : "editItem");
    }
    return this.i18nService.t(suffix ? `viewItemHeader${suffix}` : "viewItem");
  });

  async ngOnInit() {
    const config = await this.formConfigService.buildConfig(
      this.params.mode === "view" ? "edit" : this.params.mode,
      this.params.cipherId ?? undefined,
      this.params.cipherType,
    );
    this.config.set(config);

    if (config.originalCipher) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const cipherView = await this.cipherService.decrypt(config.originalCipher, userId);
      this.cipher.set(cipherView);
      this.collections.set(
        this.params.allCollections.filter((c) => cipherView.collectionIds?.includes(c.id)),
      );
    }
  }

  static openDrawer(
    dialogService: DialogService,
    params: VaultItemDrawerParams,
  ): DialogRef<VaultItemDrawerResult> {
    return dialogService.openDrawer<VaultItemDrawerResult, VaultItemDrawerParams>(
      VaultItemDrawerComponent,
      { data: params },
    );
  }

  onCopy(): void {
    this.messagingService.send("minimizeOnCopy");
  }

  protected async openAttachmentsDialog() {
    const cipher = this.cipher();
    if (!cipher) {
      return;
    }
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const hasPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
    );
    if (!hasPremium) {
      await this.premiumUpgradePromptService.promptForPremium(cipher.organizationId);
      return;
    }
    AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipher.id as CipherId,
      canEditCipher: cipher.edit,
    });
  }

  protected formStatusChanged(status: "disabled" | "enabled") {
    this.formDisabled.set(status === "disabled");
  }

  protected async switchToEdit() {
    const config = await this.formConfigService.buildConfig(
      "edit",
      this.params.cipherId ?? undefined,
      this.params.cipherType,
    );
    this.config.set(config);
    this.action.set("edit");
    await this.syncUrl("edit", this.cipher()?.id ?? null);
  }

  protected async savedCipher(cipher: CipherView) {
    this.cipher.set(cipher);
    this.collections.set(
      this.params.allCollections.filter((c) => cipher.collectionIds?.includes(c.id)),
    );
    this.action.set("view");
    await this.syncUrl("view", cipher.id);
  }

  protected async deleteCipher() {
    const cipher = this.cipher();
    if (!cipher) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: cipher.isDeleted ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      if (cipher.isDeleted) {
        await this.cipherService.deleteWithServer(cipher.id, userId);
      } else {
        await this.cipherService.softDeleteWithServer(cipher.id, userId);
      }
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t(cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem"),
      });
      this.messagingService.send(cipher.isDeleted ? "permanentlyDeletedCipher" : "deletedCipher");
      this.dialogRef.close(VaultItemDrawerResult.Deleted);
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async cancelCipher() {
    if (this.dirtyInput() && (await this.wantsToSaveChanges())) {
      return;
    }
    const cipher = this.cipher();
    if (cipher) {
      this.action.set("view");
      await this.syncUrl("view", cipher.id);
    } else {
      this.dialogRef.close();
    }
  }

  protected async closeDrawer() {
    if (this.dirtyInput() && (await this.wantsToSaveChanges())) {
      return;
    }
    this.dialogRef.close(this.cipher() ? VaultItemDrawerResult.Saved : undefined);
  }

  private dirtyInput(): boolean {
    const action = this.action();
    return (
      (action === "add" || action === "edit" || action === "clone") &&
      document.querySelectorAll("vault-cipher-form .ng-dirty").length > 0
    );
  }

  private async wantsToSaveChanges(): Promise<boolean> {
    const confirmed = await this.dialogService
      .openSimpleDialog({
        title: { key: "unsavedChangesTitle" },
        content: { key: "unsavedChangesConfirmation" },
        type: "warning",
      })
      .catch(() => false);
    return !confirmed;
  }

  private async syncUrl(action: string, itemId: string | null) {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { action, itemId },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
}
