import { ChangeDetectionStrategy, Component, OnInit, Signal, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom, from } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ChangeEmailService } from "@bitwarden/common/auth/services/change-email/change-email.service";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-change-email",
  templateUrl: "change-email.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
})
export class ChangeEmailComponent implements OnInit {
  protected readonly userVerificationSuccessful = signal(false);
  protected readonly showTwoFactorEmailWarning = signal(false);
  protected readonly userId = signal<UserId | undefined>(undefined);

  protected readonly selfServiceChangeEmailEnabled: Signal<boolean>;

  readonly formGroup = this.formBuilder.group({
    userVerificationAndNewEmail: this.formBuilder.group({
      masterPassword: ["", [Validators.required]],
      newEmail: ["", [Validators.required, Validators.email]],
    }),
    emailOwnershipVerification: [{ value: "", disabled: true }, [Validators.required]],
  });

  constructor(
    private readonly accountService: AccountService,
    private readonly twoFactorService: TwoFactorService,
    private readonly i18nService: I18nService,
    private readonly messagingService: MessagingService,
    private readonly formBuilder: FormBuilder,
    private readonly toastService: ToastService,
    private readonly changeEmailService: ChangeEmailService,
    private readonly configService: ConfigService,
  ) {
    this.selfServiceChangeEmailEnabled = toSignal(
      from(this.configService.getFeatureFlag(FeatureFlag.PM30806_SelfServiceChangeEmailCommand)),
      { initialValue: false },
    );
  }

  async ngOnInit() {
    this.userId.set(await firstValueFrom(getUserId(this.accountService.activeAccount$)));

    const twoFactorProviders = await this.twoFactorService.getEnabledTwoFactorProviders();
    this.showTwoFactorEmailWarning.set(
      twoFactorProviders.data.some((p) => p.type === TwoFactorProviderType.Email && p.enabled),
    );
  }

  readonly submit = async () => {
    const userId = this.userId();
    if (userId == null) {
      throw new Error("Can't find user");
    }

    // This form has multiple steps, so we need to mark all the groups as touched.
    this.formGroup.controls.userVerificationAndNewEmail.markAllAsTouched();

    if (this.userVerificationSuccessful()) {
      this.formGroup.controls.emailOwnershipVerification.markAllAsTouched();
    }

    if (this.formGroup.invalid) {
      return;
    }

    const userVerificationForm = this.formGroup.controls.userVerificationAndNewEmail.value;
    const newEmail = userVerificationForm.newEmail?.trim().toLowerCase();
    const masterPassword = userVerificationForm.masterPassword;

    const ctx = "Could not update email.";
    assertNonNullish(newEmail, "email", ctx);
    assertNonNullish(masterPassword, "password", ctx);

    if (!this.userVerificationSuccessful()) {
      await this.changeEmailService.requestEmailToken(masterPassword, newEmail, userId);
      this.advanceToEmailOwnershipVerification();
    } else {
      const emailOtp = this.formGroup.value.emailOwnershipVerification;
      if (emailOtp == null) {
        throw new Error("Missing token");
      }

      await this.changeEmailService.confirmEmailChange(masterPassword, newEmail, emailOtp, userId);
      this.resetFormsToInitialState();
      if (this.selfServiceChangeEmailEnabled()) {
        await this.accountService.setAccountEmail(userId, newEmail);
        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("emailChanged"),
          message: "",
        });
      } else {
        this.toastService.showToast({
          variant: "success",
          title: this.i18nService.t("emailChanged"),
          message: this.i18nService.t("logBackIn"),
        });
        this.messagingService.send("logout");
      }
    }
  };

  advanceToEmailOwnershipVerification() {
    this.formGroup.controls.userVerificationAndNewEmail.disable();
    this.formGroup.controls.emailOwnershipVerification.enable();

    this.userVerificationSuccessful.set(true);
  }

  resetFormsToInitialState() {
    this.formGroup.reset();
    this.formGroup.controls.userVerificationAndNewEmail.enable();
    this.formGroup.controls.emailOwnershipVerification.disable();

    this.userVerificationSuccessful.set(false);
  }
}
