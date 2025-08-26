import { Component, computed, inject, input, model, output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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

import {
  UnlockOption,
  UnlockOptions,
  UnlockOptionValue,
} from "../../services/lock-component.service";

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

  activeUnlockOption = model.required<UnlockOptionValue>();

  unlockOptions = input.required<UnlockOptions>();
  biometricUnlockBtnText = input.required<string>();
  showPinSwap = computed(() => this.unlockOptions().pin.enabled);
  biometricsAvailable = computed(() => this.unlockOptions().biometrics.enabled ?? false);
  showBiometricsSwap = computed(() => {
    const status = this.unlockOptions().biometrics.biometricsStatus;
    return (
      status !== BiometricsStatus.PlatformUnsupported &&
      status !== BiometricsStatus.NotEnabledLocally
    );
  });

  successfulUnlock = output<UserKey>();
  logOut = output<void>();

  protected formGroup = new FormGroup({
    masterPassword: new FormControl("", {
      validators: [Validators.required],
      updateOn: "submit",
    }),
  });

  submit = async (): Promise<void> => {
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

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount == null) {
      throw new Error("No active account found");
    }

    await this.unlockViaMasterPassword(masterPassword, activeAccount);
  };

  protected swapToPinView() {
    this.activeUnlockOption.set(UnlockOption.Pin);
  }

  protected swapToBiometricsView() {
    this.activeUnlockOption.set(UnlockOption.Biometrics);
  }

  private async unlockViaMasterPassword(
    masterPassword: string,
    activeAccount: Account,
  ): Promise<void> {
    try {
      const userKey = await this.masterPasswordUnlockService.unlockWithMasterPassword(
        masterPassword,
        activeAccount,
      );
      this.successfulUnlock.emit(userKey);
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
