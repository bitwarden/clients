import { DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { InputVerbatimDirective } from "@bitwarden/angular/directives/input-verbatim.directive";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  AsyncActionsModule,
  BitIconButtonComponent,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";

import { KeyRotationDialogService } from "./key-rotation-dialog.service";

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyRotationDialogComponent implements OnInit {
  protected readonly form = new FormGroup({
    masterPassword: new FormControl("", {
      validators: [Validators.required],
      updateOn: "submit",
    }),
  });

  protected readonly isMasterPasswordEncryptionUser = signal(false);
  protected readonly isKeyConnectorEncryptionUser = signal(false);

  private readonly keyRotationDialogService = inject(KeyRotationDialogService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogRef = inject(DialogRef<KeyRotationDialogComponent>);
  private readonly validationService = inject(ValidationService);
  private readonly logService = inject(LogService);
  private readonly keyConnectorService = inject(KeyConnectorService);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);

  async ngOnInit() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const usesKeyConnector = await this.keyConnectorService.getUsesKeyConnector(userId);

    if (usesKeyConnector) {
      this.isKeyConnectorEncryptionUser.set(true);
      return;
    }

    const hasMasterPassword = await firstValueFrom(
      this.userDecryptionOptionsService.hasMasterPasswordById$(userId),
    );
    this.isMasterPasswordEncryptionUser.set(hasMasterPassword);
  }

  protected readonly submit = async () => {
    if (this.isMasterPasswordEncryptionUser()) {
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

      let closeDialog = false;
      if (this.isMasterPasswordEncryptionUser()) {
        closeDialog = await this.keyRotationDialogService.rotateKeys(
          this.form.value.masterPassword!,
          userId,
        );
      } else if (this.isKeyConnectorEncryptionUser()) {
        closeDialog = await this.keyRotationDialogService.rotateKeysForKeyConnector(userId);
      }

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
