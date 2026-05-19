import { DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { InputVerbatimDirective } from "@bitwarden/angular/directives/input-verbatim.directive";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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

  protected readonly submit = async () => {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.value.masterPassword) {
      return;
    }
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    this.dialogRef.disableClose = true;
    try {
      if (await this.keyRotationDialogService.hasLegacyCipherAttachments(userId)) {
        this.dialogRef.close();
        await this.displayLegacyAttachmentWarning();
        return;
      }

      const closeDialog = await this.keyRotationDialogService.rotateKeys(
        this.form.value.masterPassword,
        userId,
      );
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
