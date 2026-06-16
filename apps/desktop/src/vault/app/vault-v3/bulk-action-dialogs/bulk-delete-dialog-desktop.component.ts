import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CollectionId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CenterPositionStrategy,
  DialogConfig,
  DialogModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { BulkDeleteDialogParams, BulkDeleteDialogResult } from "@bitwarden/vault";

@Component({
  standalone: true,
  templateUrl: "bulk-delete-dialog-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, I18nPipe, AsyncActionsModule],
})
export class BulkDeleteDialogDesktopComponent {
  private readonly dialogData = inject<BulkDeleteDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<BulkDeleteDialogResult>>(DialogRef);
  private readonly cipherService = inject(CipherService);
  private readonly i18nService = inject(I18nService);
  private readonly apiService = inject(ApiService);
  private readonly collectionService = inject(CollectionService);
  private readonly toastService = inject(ToastService);
  private readonly accountService = inject(AccountService);
  private readonly syncService = inject(SyncService);

  protected readonly cipherIds: string[];
  protected readonly permanent: boolean;
  protected readonly organization: Organization | undefined;
  protected readonly organizations: Organization[] | undefined;
  protected readonly collections: CollectionView[];
  protected readonly unassignedCiphers: string[];

  constructor() {
    this.cipherIds = this.dialogData.cipherIds ?? [];
    this.permanent = this.dialogData.permanent ?? false;
    this.organization = this.dialogData.organization;
    this.organizations = this.dialogData.organizations;
    this.collections = this.dialogData.collections ?? [];
    this.unassignedCiphers = this.dialogData.unassignedCiphers ?? [];
  }

  protected async cancel() {
    this.close(BulkDeleteDialogResult.Canceled);
  }

  protected readonly submit = async () => {
    const deletePromises: Promise<void>[] = [];

    if (this.unassignedCiphers.length && this.organization?.canEditUnassignedCiphers) {
      deletePromises.push(this.deleteCiphersAdmin(this.unassignedCiphers));
    }
    if (this.cipherIds.length) {
      if (!this.organization || !this.organization.canEditAllCiphers) {
        deletePromises.push(this.deleteCiphers());
      } else {
        deletePromises.push(this.deleteCiphersAdmin(this.cipherIds));
      }
    }
    if (this.collections.length) {
      deletePromises.push(this.deleteCollections());
    }

    await Promise.all(deletePromises);

    if (this.cipherIds.length || this.unassignedCiphers.length) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(this.permanent ? "permanentlyDeletedItems" : "deletedItems"),
      });
    }
    if (this.collections.length) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.collectionService.delete(
        this.collections.map((c) => c.id as CollectionId),
        userId,
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("deletedCollections"),
      });
    }
    this.close(BulkDeleteDialogResult.Deleted);
  };

  private async deleteCiphers(): Promise<void> {
    const asAdmin = this.organization?.canEditAllCiphers;
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (this.permanent) {
      await this.cipherService.deleteManyWithServer(this.cipherIds, activeUserId, asAdmin);
    } else {
      await this.cipherService.softDeleteManyWithServer(this.cipherIds, activeUserId, asAdmin);
    }
  }

  private async deleteCiphersAdmin(ciphers: string[]): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (this.permanent) {
      await this.cipherService.deleteManyWithServer(ciphers, userId, true, this.organization!.id);
    } else {
      await this.cipherService.softDeleteManyWithServer(
        ciphers,
        userId,
        true,

        this.organization!.id,
      );
    }
  }

  private async deleteCollections(): Promise<void> {
    if (!this.collections.length) {
      return;
    }

    const fullSync = async () => {
      await this.syncService.fullSync(true);
    };

    if (this.organization) {
      if (this.collections.some((c) => !c.canDelete(this.organization))) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("missingPermissions"),
        });
        return;
      }
      await this.apiService.deleteManyCollections(
        this.organization.id,
        this.collections.map((c) => c.id),
      );
      await fullSync();
    } else if (this.organizations) {
      const deletePromises: Promise<unknown>[] = [];
      for (const organization of this.organizations) {
        const orgCollections = this.collections.filter((c) => c.organizationId === organization.id);
        if (orgCollections.some((c) => !c.canDelete(organization))) {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: this.i18nService.t("missingPermissions"),
          });
          return;
        }
        const orgCollectionIds = orgCollections.map((c) => c.id);
        deletePromises.push(
          this.apiService.deleteManyCollections(organization.id, orgCollectionIds),
        );
      }
      await Promise.all(deletePromises);
      await fullSync();
    }
  }

  private close(result: BulkDeleteDialogResult) {
    void this.dialogRef.close(result);
  }

  static open(dialogService: DialogService, config: DialogConfig<BulkDeleteDialogParams>) {
    return dialogService.open<BulkDeleteDialogResult, BulkDeleteDialogParams>(
      BulkDeleteDialogDesktopComponent,
      {
        positionStrategy: new CenterPositionStrategy(),
        ...config,
      },
    );
  }
}
