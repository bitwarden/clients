// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { VerificationWithSecret } from "@bitwarden/common/auth/types/verification";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UserVerificationComponent } from "../app/components/user-verification.component";

@Component({
  selector: "app-delete-account",
  templateUrl: "delete-account.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    UserVerificationFormInputComponent,
    I18nPipe,
    UserVerificationComponent,
    ButtonModule,
    CalloutModule,
    AsyncActionsModule,
    DialogModule,
    ReactiveFormsModule,
  ],
})
export class DeleteAccountComponent {
  private readonly i18nService = inject(I18nService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly accountApiService = inject(AccountApiService);
  private readonly toastService = inject(ToastService);
  private readonly configService = inject(ConfigService);
  private readonly dialogRef = inject(DialogRef);

  readonly deleteForm = this.formBuilder.group({
    verification: undefined as VerificationWithSecret | undefined,
  });

  /**
   * Tracks whether the verification failed due to invalid credentials.
   * Used to show inline error messages in the verification component.
   */
  protected readonly invalidSecret = signal(false);

  /**
   * Feature flag for UI Migration Milestone 4
   */
  protected readonly migrationMilestone4 = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.DesktopUiMigrationMilestone4),
    { initialValue: false },
  );

  static open(dialogService: DialogService): DialogRef<DeleteAccountComponent> {
    return dialogService.open(DeleteAccountComponent);
  }

  get secret() {
    return this.deleteForm.get("verification")?.value?.secret;
  }

  readonly submit = async () => {
    if (!this.migrationMilestone4()) {
      const verification = this.deleteForm.get("verification").value;
      await this.accountApiService.deleteAccount(verification);
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("accountDeleted"),
        message: this.i18nService.t("accountDeletedDesc"),
      });
      return;
    }
    try {
      this.invalidSecret.set(false);
      const verification = this.deleteForm.get("verification").value;
      await this.accountApiService.deleteAccount(verification);
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("accountDeleted"),
        message: this.i18nService.t("accountDeletedDesc"),
      });
      this.dialogRef.close();
    } catch {
      this.invalidSecret.set(true);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("userVerificationFailed"),
      });
    }
  };
}
