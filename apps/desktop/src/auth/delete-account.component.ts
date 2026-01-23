// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
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

import { UserVerificationComponent } from "../app/components/user-verification.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-delete-account",
  templateUrl: "delete-account.component.html",
  imports: [
    JslibModule,
    UserVerificationFormInputComponent,
    UserVerificationComponent,
    ButtonModule,
    CalloutModule,
    AsyncActionsModule,
    DialogModule,
    ReactiveFormsModule,
  ],
})
export class DeleteAccountComponent implements OnInit {
  deleteForm = this.formBuilder.group({
    verification: undefined as VerificationWithSecret | undefined,
  });

  /**
   * Tracks whether the verification failed due to invalid credentials.
   * Used to show inline error messages in the verification component.
   */
  protected invalidSecret = false;

  /**
   * Feature flag for UI Migration Milestone 4
   */
  protected migrationMilestone4 = false;

  constructor(
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private accountApiService: AccountApiService,
    private toastService: ToastService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.migrationMilestone4 = await this.configService.getFeatureFlag(
      FeatureFlag.DesktopUiMigrationMilestone4,
    );
  }

  static open(dialogService: DialogService): DialogRef<DeleteAccountComponent> {
    return dialogService.open(DeleteAccountComponent);
  }

  get secret() {
    return this.deleteForm.get("verification")?.value?.secret;
  }

  submit = async () => {
    try {
      if (this.migrationMilestone4) {
        this.invalidSecret = false;
      }
      const verification = this.deleteForm.get("verification").value;
      await this.accountApiService.deleteAccount(verification);
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("accountDeleted"),
        message: this.i18nService.t("accountDeletedDesc"),
      });
    } catch {
      if (this.migrationMilestone4) {
        this.invalidSecret = true;
      }
    }
  };
}
