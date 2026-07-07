import { DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom, forkJoin, map, switchMap } from "rxjs";

import { InputVerbatimDirective } from "@bitwarden/angular/directives/input-verbatim.directive";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BitIconButtonComponent,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  SpinnerComponent,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";

import { KeyRotationDialogService } from "./key-rotation-dialog.service";

type UserPrimaryEncryptionType = "masterPassword" | "keyConnector" | "TDE";

@Component({
  selector: "key-rotation-dialog",
  templateUrl: "key-rotation-dialog.component.html",
  imports: [
    DialogModule,
    ButtonModule,
    I18nPipe,
    FormFieldModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    CalloutModule,
    BitIconButtonComponent,
    InputVerbatimDirective,
    TypographyModule,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyRotationDialogComponent {
  protected readonly form = new FormGroup({
    masterPassword: new FormControl("", {
      validators: [Validators.required],
      updateOn: "submit",
    }),
  });

  private readonly keyRotationDialogService = inject(KeyRotationDialogService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogRef = inject(DialogRef<KeyRotationDialogComponent>);
  private readonly validationService = inject(ValidationService);
  private readonly logService = inject(LogService);
  private readonly keyConnectorService = inject(KeyConnectorService);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
  private readonly deviceTrustService = inject(DeviceTrustServiceAbstraction);

  protected readonly userPrimaryEncryptionType = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        forkJoin([
          firstValueFrom(this.userDecryptionOptionsService.hasMasterPasswordById$(userId)),
          this.keyConnectorService.getUsesKeyConnector(userId),
          this.keyConnectorService.getManagingOrganization(userId),
          firstValueFrom(this.deviceTrustService.supportsDeviceTrustByUserId$(userId)),
        ]).pipe(
          map(
            ([hasMasterPassword, usesKeyConnector, keyConnectorManagingOrganization, usesTde]):
              | UserPrimaryEncryptionType
              | undefined => {
              if (hasMasterPassword) {
                return "masterPassword";
              }
              if (usesKeyConnector && keyConnectorManagingOrganization != null) {
                return "keyConnector";
              }
              if (usesTde) {
                return "TDE";
              }
              return undefined;
            },
          ),
        ),
      ),
    ),
  );

  protected readonly loading = computed(() => this.userPrimaryEncryptionType() == null);

  protected readonly submit = async () => {
    if (this.loading()) {
      return;
    }

    const encryptionType = this.userPrimaryEncryptionType()!;

    if (encryptionType === "masterPassword") {
      this.form.markAllAsTouched();
      if (this.form.invalid || !this.form.value.masterPassword) {
        return;
      }
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    this.dialogRef.disableClose = true;
    try {
      if (await this.keyRotationDialogService.hasLegacyCipherAttachments(userId)) {
        this.dialogRef.close();
        await this.displayLegacyAttachmentWarning();
        return;
      }

      const closeDialog = await this.performKeyRotation(encryptionType, userId);

      if (closeDialog) {
        this.dialogRef.close();
      }
    } catch (error) {
      this.logService.error(error);
      this.validationService.showError(error);
    } finally {
      this.dialogRef.disableClose = false;
    }
  };

  private async performKeyRotation(
    encryptionType: UserPrimaryEncryptionType,
    userId: UserId,
  ): Promise<boolean> {
    switch (encryptionType) {
      case "masterPassword":
        return this.keyRotationDialogService.rotateKeys(this.form.value.masterPassword!, userId);
      case "keyConnector":
        return this.keyRotationDialogService.rotateKeysForKeyConnector(userId);
      case "TDE":
        return this.keyRotationDialogService.rotateKeysForTDE(userId);
    }
  }

  private async displayLegacyAttachmentWarning() {
    const learnMore = await this.dialogService.openSimpleDialog({
      title: { key: "warning" },
      content: { key: "oldAttachmentsNeedFixDesc" },
      acceptButtonText: { key: "learnMore" },
      cancelButtonText: { key: "close" },
      type: "warning",
    });

    if (learnMore) {
      this.platformUtilsService.launchUri(
        "https://bitwarden.com/help/attachments/#fixing-old-attachments",
      );
    }
  }

  /**
   * Strongly typed helper to open a KeyRotationDialogComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   */
  static open(dialogService: DialogService) {
    return dialogService.open(KeyRotationDialogComponent);
  }
}
