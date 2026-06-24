import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CenterPositionStrategy,
  DialogConfig,
  DialogModule,
  DialogService,
  IconModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { BulkDeleteDialogParams, BulkDeleteDialogResult } from "@bitwarden/vault";

@Component({
  standalone: true,
  templateUrl: "bulk-delete-dialog-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonModule, I18nPipe, AsyncActionsModule, IconModule],
})
export class BulkDeleteDialogDesktopComponent {
  private readonly dialogData = inject<BulkDeleteDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<BulkDeleteDialogResult>>(DialogRef);
  private readonly cipherService = inject(CipherService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly accountService = inject(AccountService);

  protected readonly cipherIds: string[];
  protected readonly permanent: boolean;
  protected readonly organization: Organization | undefined;
  protected readonly organizations: Organization[] | undefined;
  protected readonly unassignedCiphers: string[];

  constructor() {
    this.cipherIds = this.dialogData.cipherIds ?? [];
    this.permanent = this.dialogData.permanent ?? false;
    this.organization = this.dialogData.organization;
    this.organizations = this.dialogData.organizations;
    this.unassignedCiphers = this.dialogData.unassignedCiphers ?? [];
  }

  protected get totalCiphersCount(): number {
    return this.cipherIds.length + this.unassignedCiphers.length;
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

    await Promise.all(deletePromises);

    if (this.totalCiphersCount) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(this.permanent ? "permanentlyDeletedItems" : "deletedItems"),
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
