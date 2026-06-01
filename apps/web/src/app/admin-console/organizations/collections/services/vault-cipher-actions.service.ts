import { inject, Injectable } from "@angular/core";
import { NavigationExtras, Router } from "@angular/router";
import { combineLatest, firstValueFrom, lastValueFrom, Observable, Subject } from "rxjs";
import { distinctUntilChanged, filter, map, shareReplay, switchMap } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId, CipherId, CollectionId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  AttachmentDialogResult,
  AttachmentsV2Component,
  CipherFormConfig,
  CipherFormConfigService,
  CollectionAssignmentResult,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterService,
  VaultFilter,
  VaultItemDialogComponent,
  VaultItemDialogMode,
  VaultItemDialogResult,
} from "@bitwarden/vault";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";

import { AssignCollectionsWebComponent } from "../../../../vault/components/assign-collections";
import {
  BulkDeleteDialogResult,
  openBulkDeleteDialog,
} from "../../../../vault/individual-vault/bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import { ACRoutedVaultFilterModel, toACFilter } from "../models/ac-routed-vault-filter.model";

import { VaultCollectionService } from "./vault-collection.service";

@Injectable()
export class VaultCipherActionsService {
  private readonly cipherService = inject(CipherService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly cipherFormConfigService = inject(CipherFormConfigService);
  private readonly totpService = inject(TotpService);
  private readonly eventCollectionService = inject(EventCollectionService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);
  private readonly messagingService = inject(MessagingService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly router = inject(Router);
  private readonly i18nService = inject(I18nService);
  private readonly organizationService = inject(OrganizationService);
  private readonly routedVaultFilterService = inject(RoutedVaultFilterService);
  private readonly routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private readonly vaultCollectionService = inject(VaultCollectionService);

  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  private readonly filter$: Observable<ACRoutedVaultFilterModel> =
    this.routedVaultFilterService.filter$.pipe(map(toACFilter), filter(Boolean));

  private readonly organizationId$ = this.filter$.pipe(
    map((f) => f.organizationId),
    distinctUntilChanged(),
  );

  private readonly organization$: Observable<Organization> = combineLatest([
    this.organizationId$,
    this.userId$,
  ]).pipe(
    switchMap(([orgId, userId]) =>
      this.organizationService.organizations$(userId).pipe(getById(orgId)),
    ),
    filter((org) => org != null),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  readonly activeFilter$: Observable<VaultFilter> =
    this.routedVaultFilterBridgeService.activeFilter$;

  private readonly _refresh$ = new Subject<void>();
  private readonly _navigate$ = new Subject<{ queryParams: unknown; options?: NavigationExtras }>();

  readonly refresh$ = this._refresh$.asObservable();
  readonly navigate$ = this._navigate$.asObservable();

  private vaultItemDialogRef?: DialogRef<VaultItemDialogResult>;

  get hasOpenDialog(): boolean {
    return this.vaultItemDialogRef != undefined;
  }

  private refresh(): void {
    this._refresh$.next();
  }

  private go(queryParams: unknown, navigateOptions?: NavigationExtras): void {
    this._navigate$.next({ queryParams, options: navigateOptions });
  }

  async editCipherAttachments(cipher: CipherView): Promise<void> {
    if (cipher.reprompt !== 0 && !(await this.passwordRepromptService.showPasswordPrompt())) {
      this.go({ cipherId: null, itemId: null }, this.configureRouterFocusToCipher(cipher.id));
      return;
    }

    const organization = await firstValueFrom(this.organization$);
    if (organization.maxStorageGb == null || organization.maxStorageGb === 0) {
      this.messagingService.send("upgradeOrganization", { organizationId: cipher.organizationId });
      return;
    }

    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipher.id as CipherId,
      organizationId: cipher.organizationId as OrganizationId,
      admin: true,
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      this.refresh();
    }
  }

  /** Opens the Add/Edit Dialog */
  async addCipher(cipherType?: CipherType): Promise<void> {
    const activeFilter = await firstValueFrom(this.activeFilter$);
    const type = cipherType ?? activeFilter.cipherType;
    const cipherFormConfig = await this.cipherFormConfigService.buildConfig("add", undefined, type);

    const collectionId: CollectionId | undefined = activeFilter.collectionId as CollectionId;

    const organization = await firstValueFrom(this.organization$);
    cipherFormConfig.initialValues = {
      organizationId: organization.id,
      collectionIds: collectionId ? [collectionId] : [],
    };

    await this.openVaultItemDialog("form", cipherFormConfig);
  }

  /**
   * Edit the given cipher or add a new cipher
   * @param cipher - When set, the cipher to be edited
   * @param cloneCipher - `true` when the cipher should be cloned.
   */
  async editCipher(cipher: CipherView | undefined, cloneCipher?: boolean): Promise<void> {
    if (
      cipher &&
      cipher.reprompt !== 0 &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      // didn't pass password prompt, so don't open add / edit modal
      this.go({ cipherId: null, itemId: null }, this.configureRouterFocusToCipher(cipher.id));
      return;
    }

    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      cloneCipher ? "clone" : "edit",
      cipher?.id as CipherId | undefined,
    );

    await this.openVaultItemDialog("form", cipherFormConfig, cipher);
  }

  /** Opens the view dialog for the given cipher unless password reprompt fails */
  async viewCipherById(cipher: CipherView): Promise<void> {
    if (!cipher) {
      return;
    }

    if (
      cipher &&
      cipher.reprompt !== 0 &&
      !(await this.passwordRepromptService.showPasswordPrompt())
    ) {
      // Didn't pass password prompt, so don't open add / edit modal.
      this.go(
        { cipherId: null, itemId: null, action: null },
        this.configureRouterFocusToCipher(cipher.id),
      );
      return;
    }

    const cipherFormConfig = await this.cipherFormConfigService.buildConfig(
      "edit",
      cipher.id as CipherId,
      cipher.type,
    );

    const activeFilter = await firstValueFrom(this.activeFilter$);
    await this.openVaultItemDialog(
      "view",
      cipherFormConfig,
      cipher,
      activeFilter.collectionId as CollectionId,
    );
  }

  /**
   * Open the combined view / edit dialog for a cipher.
   */
  async openVaultItemDialog(
    mode: VaultItemDialogMode,
    formConfig: CipherFormConfig,
    cipher?: CipherView,
    activeCollectionId?: CollectionId,
  ): Promise<void> {
    this.vaultItemDialogRef = VaultItemDialogComponent.open(this.dialogService, {
      mode,
      formConfig,
      activeCollectionId,
      isAdminConsoleAction: true,
      restore: this.restore,
    });

    const result = await lastValueFrom(this.vaultItemDialogRef.closed);
    this.vaultItemDialogRef = undefined;

    // If the dialog was closed by deleting the cipher, refresh the vault.
    if (result === VaultItemDialogResult.Deleted || result === VaultItemDialogResult.Saved) {
      this.refresh();
    }

    // When the dialog is closed for a premium upgrade, return early as the user
    // should be navigated to the subscription settings elsewhere
    if (result === VaultItemDialogResult.PremiumUpgrade) {
      return;
    }

    // Clear the query params when the dialog closes
    this.go(
      { cipherId: null, itemId: null, action: null },
      this.configureRouterFocusToCipher(formConfig.originalCipher?.id),
    );
  }

  async cloneCipher(cipher: CipherView): Promise<boolean | void> {
    if (cipher.login.hasFido2Credentials) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        return false;
      }
    }

    await this.editCipher(cipher, true);
  }

  restore = async (c: CipherViewLike): Promise<void> => {
    const organization = await firstValueFrom(this.organization$);
    if (!CipherViewLikeUtils.isDeleted(c)) {
      return;
    }

    if (
      !organization.permissions.editAnyCollection &&
      !c.edit &&
      !organization.allowAdminAccessToAllCollectionItems
    ) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher([c]))) {
      return;
    }

    // Allow restore of an Unassigned Item
    try {
      if (c.id == null || c.id === "") {
        throw new Error("Cipher must have an Id to be restored");
      }
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const asAdmin = organization.canEditAnyCollection || CipherViewLikeUtils.isUnassigned(c);
      await this.cipherService.restoreWithServer(c.id as CipherId, activeUserId, asAdmin);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("restoredItem"),
      });
      this.refresh();
      return;
    } catch (e) {
      this.logService.error(e);
      return;
    }
  };

  async bulkRestore(ciphers: CipherView[]): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    if (
      !organization.permissions.editAnyCollection &&
      ciphers.some((c) => !c.edit && !organization.allowAdminAccessToAllCollectionItems)
    ) {
      this.showMissingPermissionsError();
      return;
    }

    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    // assess if there are unassigned ciphers and/or editable ciphers selected in bulk for restore
    const editAccessCiphers: string[] = [];
    const unassignedCiphers: string[] = [];

    const userId = await firstValueFrom(this.userId$);
    // If user has edit all Access no need to check for unassigned ciphers
    if (organization.canEditAllCiphers) {
      ciphers.map((cipher) => {
        editAccessCiphers.push(cipher.id);
      });
    } else {
      ciphers.map((cipher) => {
        if (cipher.collectionIds.length === 0) {
          unassignedCiphers.push(cipher.id);
        } else if (cipher.edit) {
          editAccessCiphers.push(cipher.id);
        }
      });
    }

    if (unassignedCiphers.length === 0 && editAccessCiphers.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    if (unassignedCiphers.length > 0 || editAccessCiphers.length > 0) {
      await this.cipherService.restoreManyWithServer(
        [...unassignedCiphers, ...editAccessCiphers],
        userId,
        organization.id,
      );
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("restoredItems"),
    });
    this.refresh();
  }

  async deleteCipher(c: CipherView): Promise<boolean> {
    const organization = await firstValueFrom(this.organization$);
    if (!c.edit && !organization.canEditAllCiphers) {
      this.showMissingPermissionsError();
      return false;
    }

    if (!(await this.repromptCipher([c]))) {
      return false;
    }

    const permanent = c.isDeleted;

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: permanent ? "permanentlyDeleteItem" : "deleteItem" },
      content: { key: permanent ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.deleteCipherWithServer(c.id, activeUserId, permanent, c.isUnassigned);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(permanent ? "permanentlyDeletedItem" : "deletedItem"),
      });
      this.refresh();
      return true;
    } catch (e) {
      this.logService.error(e);
      return false;
    }
  }

  async bulkDelete(
    ciphers: CipherView[],
    collections: CollectionView[],
    organization: Organization,
  ): Promise<void> {
    if (!(await this.repromptCipher(ciphers))) {
      return;
    }

    // Allow bulk deleting of Unassigned Items
    const unassignedCiphers: string[] = [];
    const assignedCiphers: string[] = [];

    ciphers.map((c) => {
      if (c.isUnassigned) {
        unassignedCiphers.push(c.id);
      } else {
        assignedCiphers.push(c.id);
      }
    });

    if (ciphers.length === 0 && collections.length === 0) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const org = await firstValueFrom(this.organization$);
    const canDeleteCollections =
      collections == null || collections.every((c) => c.canDelete(organization));
    const canDeleteCiphers =
      ciphers == null || ciphers.every((c) => c.edit) || org.canEditAllCiphers;

    if (!canDeleteCiphers || !canDeleteCollections) {
      this.showMissingPermissionsError();
      return;
    }

    const filter = await firstValueFrom(this.filter$);
    const dialog = openBulkDeleteDialog(this.dialogService, {
      data: {
        permanent: filter.type === "trash",
        cipherIds: assignedCiphers,
        collections: collections,
        organization,
        unassignedCiphers,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === BulkDeleteDialogResult.Deleted) {
      this.refresh();
    }
  }

  async copy(cipher: CipherView, field: "username" | "password" | "totp"): Promise<void> {
    let aType;
    let value;
    let typeI18nKey;

    if (field === "username") {
      aType = "Username";
      value = cipher.login.username;
      typeI18nKey = "username";
    } else if (field === "password") {
      aType = "Password";
      value = cipher.login.password;
      typeI18nKey = "password";
    } else if (field === "totp" && cipher.login.totp != null) {
      aType = "TOTP";
      const totpResponse = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
      value = totpResponse.code;
      typeI18nKey = "verificationCodeTotp";
    } else {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("unexpectedError"),
      });
      return;
    }

    if (
      this.passwordRepromptService.protectedFields().includes(aType) &&
      !(await this.repromptCipher([cipher]))
    ) {
      return;
    }

    if (!cipher.viewPassword || value == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(value, { window: window });
    this.toastService.showToast({
      variant: "info",
      message: this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey)),
    });

    if (field === "password") {
      await this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, cipher.id);
    } else if (field === "totp") {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientCopiedHiddenField,
        cipher.id,
      );
    }
  }

  async bulkAssignToCollections(items: CipherView[]): Promise<void> {
    if (!(await this.repromptCipher(items))) {
      return;
    }

    if (items.length === 0) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("nothingSelected"),
      });
      return;
    }

    const availableCollections = await firstValueFrom(
      this.vaultCollectionService.editableCollections$,
    );
    const organization = await firstValueFrom(this.organization$);
    const activeFilter = await firstValueFrom(this.activeFilter$);
    const dialog = AssignCollectionsWebComponent.open(this.dialogService, {
      data: {
        ciphers: items,
        organizationId: organization.id,
        availableCollections,
        activeCollection: activeFilter?.selectedCollectionNode?.node,
        isSingleCipherAdmin:
          items.length === 1 && (organization.canEditAllCiphers || items[0].isUnassigned),
      },
    });

    const result = await lastValueFrom(dialog.closed);
    if (result === CollectionAssignmentResult.Saved) {
      this.refresh();
    }
  }

  async viewEvents(cipher: CipherView): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: cipher.name,
        organizationId: organization.id,
        entityId: cipher.id,
        showUser: true,
        entity: "cipher",
      },
    });
  }

  private async deleteCipherWithServer(
    id: string,
    userId: UserId,
    permanent: boolean,
    isUnassigned: boolean,
  ): Promise<void> {
    const organization = await firstValueFrom(this.organization$);
    const asAdmin = organization.canEditAllCiphers || isUnassigned;
    return permanent
      ? this.cipherService.deleteWithServer(id, userId, asAdmin)
      : this.cipherService.softDeleteWithServer(id, userId, asAdmin);
  }

  private async repromptCipher(ciphers: CipherViewLike[]): Promise<boolean> {
    const notProtected = !ciphers.find((cipher) => cipher.reprompt !== CipherRepromptType.None);
    return notProtected || (await this.passwordRepromptService.showPasswordPrompt());
  }

  /**
   * Helper function to set up the `state.focusAfterNav` property for dialog router navigation if
   * the cipherId exists. If it doesn't exist, returns undefined.
   *
   * This ensures that when the routed dialog is closed, the focus returns to the cipher button in
   * the vault table, which allows keyboard users to continue navigating uninterrupted.
   *
   * @param cipherId id of cipher
   * @returns Partial<NavigationExtras>, specifically the state.focusAfterNav property, or undefined
   */
  private configureRouterFocusToCipher(cipherId?: string): Partial<NavigationExtras> | undefined {
    if (cipherId) {
      return {
        state: { focusAfterNav: `#cipher-btn-${cipherId}` },
      };
    }
    return undefined;
  }

  private showMissingPermissionsError(): void {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("missingPermissions"),
    });
  }
}
