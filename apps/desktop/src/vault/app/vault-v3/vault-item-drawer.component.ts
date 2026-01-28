import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  signal,
  viewChild,
} from "@angular/core";
import { firstValueFrom, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DIALOG_DATA,
  DialogRef,
  DialogModule,
  DialogService,
  ButtonModule,
  IconButtonModule,
  ItemModule,
} from "@bitwarden/components";
import {
  AttachmentDialogResult,
  AttachmentsV2Component,
  CipherFormComponent,
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormMode,
  CipherFormModule,
  CipherViewComponent,
  DefaultCipherFormConfigService,
} from "@bitwarden/vault";

import { ItemFooterComponent } from "./cipher-form/item-footer.component";

/**
 * Parameters for opening the drawer in view mode.
 */
export type ViewModeParams = {
  mode: "view";
  cipher: CipherView;
  collections: CollectionView[];
};

/**
 * Parameters for opening the drawer in form mode (edit, add, clone).
 */
export type FormModeParams = {
  mode: "edit" | "add" | "clone";
  formConfig: CipherFormConfig;
};

/**
 * Parameters for opening the vault item drawer.
 * Discriminated union based on the mode.
 */
export type VaultItemDrawerParams = ViewModeParams | FormModeParams;

/**
 * Result constants for drawer close events.
 */
export const VaultItemDrawerResult = Object.freeze({
  /** The cipher was saved (created or updated). */
  Saved: "saved",
  /** The cipher was deleted. */
  Deleted: "deleted",
  /** The cipher was restored from trash. */
  Restored: "restored",
  /** The cipher was archived. */
  Archived: "archived",
} as const);

/**
 * Result type for drawer close events.
 */
export type VaultItemDrawerResult = {
  result: (typeof VaultItemDrawerResult)[keyof typeof VaultItemDrawerResult];
  cipher?: CipherView;
};

/**
 * Drawer component for viewing and editing vault items.
 * Supports view/edit mode switching and reuses existing CipherViewComponent and CipherFormComponent.
 */
@Component({
  selector: "app-vault-item-drawer",
  templateUrl: "./vault-item-drawer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    IconButtonModule,
    ItemModule,
    CipherFormModule,
    CipherViewComponent,
    ItemFooterComponent,
    PremiumBadgeComponent,
  ],
  providers: [
    {
      provide: CipherFormConfigService,
      useClass: DefaultCipherFormConfigService,
    },
  ],
})
export class VaultItemDrawerComponent implements OnDestroy {
  protected readonly cipherFormComponent = viewChild(CipherFormComponent);
  protected readonly footerComponent = viewChild(ItemFooterComponent);

  /**
   * Current display mode of the drawer.
   * - "view": Shows CipherViewComponent
   * - "form": Shows CipherFormComponent
   */
  protected readonly mode = signal<"view" | "form">("view");

  /**
   * Tracks if the form is ready to be displayed.
   * Used when switching from view to edit mode.
   */
  protected readonly formReady = signal(false);

  /**
   * Current cipher being viewed/edited.
   */
  protected readonly cipher = signal<CipherView | null>(null);

  /**
   * Configuration for the cipher form.
   * Only defined when in form mode (edit, add, clone).
   */
  protected config?: CipherFormConfig;

  /**
   * Collections associated with the cipher.
   */
  protected collections: CollectionView[] = [];

  /**
   * Tracks if the cipher was modified during this drawer session.
   * Used to determine the close result.
   */
  private readonly cipherModified = signal(false);

  /**
   * Subject to emit when the form is ready to be displayed.
   */
  private readonly formReadySubject = new Subject<void>();

  /**
   * Original mode when the drawer was first opened.
   * Used to determine behavior after saving.
   */
  private readonly originalMode: "view" | "edit" | "add" | "clone";

  /**
   * Tracks if the user has premium access for attachments.
   */
  protected canAccessPremium = false;

  /**
   * Active user ID for cipher operations.
   */
  private activeUserId: UserId | null = null;

  constructor(
    @Inject(DIALOG_DATA) protected params: VaultItemDrawerParams,
    private dialogRef: DialogRef<VaultItemDrawerResult>,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private eventCollectionService: EventCollectionService,
    private accountService: AccountService,
    private logService: LogService,
    private cipherFormConfigService: CipherFormConfigService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    this.originalMode = params.mode;

    // Handle view mode vs form mode parameters
    if (params.mode === "view") {
      // View mode: cipher and collections provided directly
      this.cipher.set(params.cipher);
      this.collections = params.collections;
      this.mode.set("view");
      void this.collectViewEvent();
    } else {
      // Form mode: extract from formConfig
      this.config = params.formConfig;

      // Decrypt originalCipher if it exists
      if (params.formConfig.originalCipher) {
        void this.decryptCipherAsync(params.formConfig.originalCipher);
      }

      this.mode.set("form");
    }

    // Initialize premium access and user ID
    void this.initializeAsync();
  }

  /**
   * Decrypt the cipher domain object to a cipher view.
   */
  private async decryptCipherAsync(cipher: any): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const decryptedCipher = await cipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(cipher, userId),
      );
      this.cipher.set(decryptedCipher);
    } catch (error) {
      this.logService.error("Failed to decrypt cipher:", error);
    }
  }

  /**
   * Initialize async dependencies.
   */
  private async initializeAsync(): Promise<void> {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.canAccessPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(this.activeUserId),
    );
  }

  /**
   * Gets the header text based on current mode and cipher type.
   */
  protected get headerText(): string {
    const currentMode = this.mode();
    const cipherType = this.cipher()?.type;

    if (currentMode === "view") {
      return this.getViewHeaderText(cipherType);
    } else {
      return this.getFormHeaderText(this.config?.mode ?? "edit", cipherType);
    }
  }

  /**
   * Gets the action string for the footer component.
   * Maps drawer mode to footer action.
   */
  protected get footerAction(): string {
    if (this.mode() === "view") {
      return "view";
    }
    return this.config?.mode ?? "edit";
  }

  /**
   * Switches from view mode to edit mode.
   * Waits for the form to be ready before proceeding.
   */
  protected async switchToEdit(): Promise<void> {
    // Rebuild config for edit mode
    const cipher = this.cipher();
    if (!cipher) {
      return;
    }

    this.config = await this.cipherFormConfigService.buildConfig("edit", cipher.id as CipherId);

    this.mode.set("form");
    this.formReady.set(false);

    // Wait for form to initialize
    await firstValueFrom(this.formReadySubject);
    this.formReady.set(true);
  }

  /**
   * Cancels the current operation.
   * - In add/clone mode: Closes the drawer
   * - In edit mode: Returns to view mode
   */
  protected cancel(): void {
    if (this.config?.mode === "add" || this.config?.mode === "clone") {
      this.dialogRef.close();
    } else {
      this.mode.set("view");
    }
  }

  /**
   * Handles cipher saved event from the form.
   * Updates the cipher, marks as modified, and switches back to view mode.
   */
  protected async onCipherSaved(cipher: CipherView): Promise<void> {
    this.cipherModified.set(true);
    this.cipher.set(cipher);

    // If this was an add or clone operation, switch to edit mode for continued editing
    if (this.config?.mode === "add" || this.config?.mode === "clone") {
      this.config = await this.cipherFormConfigService.buildConfig("edit", cipher.id as CipherId);
    }

    // Switch back to view mode
    this.mode.set("view");

    // Collect save event
    // const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.eventCollectionService.collect(
      EventType.Cipher_Updated,
      cipher.id as CipherId,
      false,
      cipher.organizationId,
    );
  }

  /**
   * Handles form ready event.
   * Signals that the form has initialized and is ready for interaction.
   */
  protected onFormReady(): void {
    this.formReadySubject.next();
  }

  /**
   * Handles edit button click from footer.
   */
  protected async handleEdit(): Promise<void> {
    await this.switchToEdit();
  }

  /**
   * Handles clone button click from footer.
   */
  protected async handleClone(): Promise<void> {
    const cipher = this.cipher();
    if (!cipher) {
      return;
    }

    this.config = await this.cipherFormConfigService.buildConfig("clone", cipher.id as CipherId);
    this.mode.set("form");
  }

  /**
   * Handles delete button click from footer.
   * Closes drawer with deleted result.
   */
  protected handleDelete(): void {
    this.dialogRef.close({
      result: VaultItemDrawerResult.Deleted,
      cipher: this.cipher() ?? undefined,
    });
  }

  /**
   * Handles restore button click from footer.
   * Closes drawer with restored result.
   */
  protected handleRestore(): void {
    this.dialogRef.close({
      result: VaultItemDrawerResult.Restored,
      cipher: this.cipher() ?? undefined,
    });
  }

  /**
   * Handles archive toggle from footer.
   * Refreshes the cipher to reflect new archive state.
   */
  protected async handleArchiveToggle(): Promise<void> {
    const cipher = this.cipher();
    if (!cipher?.id) {
      return;
    }

    try {
      // Reload the cipher to get updated archive state
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const updatedCipher = await this.cipherService.get(cipher.id, userId);
      if (updatedCipher) {
        const decryptedCipher = await updatedCipher.decrypt(
          await this.cipherService.getKeyForCipherKeyDecryption(updatedCipher, userId),
        );
        this.cipher.set(decryptedCipher);
        this.cipherModified.set(true);
      }
    } catch (error) {
      this.logService.error("Failed to refresh cipher after archive toggle:", error);
    }
  }

  /**
   * Collects view event for analytics.
   */
  private async collectViewEvent(): Promise<void> {
    const cipher = this.cipher();
    if (!cipher?.id) {
      return;
    }

    await this.eventCollectionService.collect(
      EventType.Cipher_ClientViewed,
      cipher.id as CipherId,
      false,
      cipher.organizationId,
    );
  }

  /**
   * Gets header text for view mode.
   */
  private getViewHeaderText(type: CipherType | undefined): string {
    if (!type) {
      return this.i18nService.t("viewItem");
    }

    const typeMap: Partial<Record<CipherType, string>> = {
      [CipherType.Login]: "viewLogin",
      [CipherType.Card]: "viewCard",
      [CipherType.Identity]: "viewIdentity",
      [CipherType.SecureNote]: "viewSecureNote",
    };

    return this.i18nService.t(typeMap[type] ?? "viewItem");
  }

  /**
   * Gets header text for form mode.
   */
  private getFormHeaderText(mode: CipherFormMode, type: CipherType | undefined): string {
    const prefix = mode === "edit" ? "edit" : mode === "clone" ? "clone" : "new";

    if (!type) {
      return this.i18nService.t(`${prefix}Item`);
    }

    const typeMap: Partial<Record<CipherType, string>> = {
      [CipherType.Login]: `${prefix}Login`,
      [CipherType.Card]: `${prefix}Card`,
      [CipherType.Identity]: `${prefix}Identity`,
      [CipherType.SecureNote]: `${prefix}SecureNote`,
    };

    return this.i18nService.t(typeMap[type] ?? `${prefix}Item`);
  }

  /**
   * Opens the attachments dialog for the current cipher.
   * Only available for premium users.
   */
  protected async openAttachmentsDialog(): Promise<void> {
    if (!this.canAccessPremium) {
      return;
    }

    const cipher = this.cipher();
    if (!cipher?.id) {
      return;
    }

    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipher.id as CipherId,
    });

    const result = await firstValueFrom(dialogRef.closed).catch((): any => null);

    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      const formComponent = this.cipherFormComponent();
      if (formComponent == null) {
        return;
      }

      // The encrypted state of ciphers is updated when an attachment is added,
      // but the cache is also cleared. Depending on timing, `cipherService.get` can return the
      // old cipher. Retrieve the updated cipher from `cipherViews$`,
      // which refreshes after the cache is cleared.
      const updatedCipherView = await firstValueFrom(
        this.cipherService.cipherViews$(this.activeUserId!).pipe(
          filter((c) => !!c),
          map((ciphers) => ciphers.find((c) => c.id === cipher.id)),
        ),
      );

      // `find` can return undefined but that shouldn't happen as
      // this would mean that the cipher was deleted.
      // To make TypeScript happy, exit early if it isn't found.
      if (!updatedCipherView) {
        return;
      }

      formComponent.patchCipher((currentCipher) => {
        currentCipher.attachments = updatedCipherView.attachments;
        currentCipher.revisionDate = updatedCipherView.revisionDate;

        return currentCipher;
      });
    }
  }

  /**
   * Cleanup on component destroy.
   * Ensures drawer closes with correct result if modified.
   */
  ngOnDestroy(): void {
    if (this.cipherModified()) {
      this.dialogRef.close({
        result: VaultItemDrawerResult.Saved,
        cipher: this.cipher() ?? undefined,
      });
    }
  }

  /**
   * Static factory method to open the drawer.
   */
  static openDrawer(
    dialogService: DialogService,
    params: VaultItemDrawerParams,
  ): DialogRef<VaultItemDrawerResult> {
    return dialogService.openDrawer<VaultItemDrawerResult, VaultItemDrawerParams>(
      VaultItemDrawerComponent,
      {
        data: params,
      },
    );
  }
}
