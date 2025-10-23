import { Component, computed, inject, input, model, output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserKey } from "@bitwarden/common/types/key";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";
import { BiometricsStatus } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import {
  UnlockOption,
  UnlockOptions,
  UnlockOptionValue,
} from "../../services/lock-component.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-master-password-lock",
  templateUrl: "master-password-lock.component.html",
  imports: [
    JslibModule,
    ReactiveFormsModule,
    ButtonModule,
    FormFieldModule,
    AsyncActionsModule,
    IconButtonModule,
  ],
})
export class MasterPasswordLockComponent {
  private readonly accountService = inject(AccountService);
  private readonly masterPasswordUnlockService = inject(MasterPasswordUnlockService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  UnlockOption = UnlockOption;

  readonly activeUnlockOption = model.required<UnlockOptionValue>();

  readonly unlockOptions = input.required<UnlockOptions>();
  readonly biometricUnlockBtnText = input.required<string>();
  readonly showPinSwap = computed(() => this.unlockOptions().pin.enabled ?? false);
  readonly biometricsAvailable = computed(() => this.unlockOptions().biometrics.enabled ?? false);
  readonly showBiometricsSwap = computed(() => {
    const status = this.unlockOptions().biometrics.biometricsStatus;
    return (
      status !== BiometricsStatus.PlatformUnsupported &&
      status !== BiometricsStatus.NotEnabledLocally
    );
  });

  successfulUnlock = output<{ userKey: UserKey; masterPassword: string }>();
  logOut = output<void>();

  formGroup = new FormGroup({
    masterPassword: new FormControl("", {
      validators: [Validators.required],
      updateOn: "submit",
    }),
  });

  submit = async () => {
    this.formGroup.markAllAsTouched();
    const masterPassword = this.formGroup.controls.masterPassword.value;
    if (this.formGroup.invalid || !masterPassword) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
      return;
    }

    const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    await this.unlockViaMasterPassword(masterPassword, activeUserId);
  };

  private async unlockViaMasterPassword(
    masterPassword: string,
    activeUserId: UserId,
  ): Promise<void> {
    try {
      const userKey = await this.masterPasswordUnlockService.unlockWithMasterPassword(
        masterPassword,
        activeUserId,
      );
      this.successfulUnlock.emit({ userKey, masterPassword });
    } catch (error) {
      this.logService.error(
        "[MasterPasswordLockComponent] Failed to unlock via master password",
        error,
      );
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidMasterPassword"),
      });
    }
  }
}
