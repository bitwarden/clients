import {
  Component,
  computed,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
} from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/client-type";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
import { CommandDefinition, MessageListener } from "@bitwarden/messaging";
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
export class MasterPasswordLockComponent implements OnInit, OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly masterPasswordUnlockService = inject(MasterPasswordUnlockService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly messageListener = inject(MessageListener);
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

  protected showPassword = false;
  private destroy$ = new Subject<void>();

  formGroup = new FormGroup({
    masterPassword: new FormControl("", {
      validators: [Validators.required],
      updateOn: "submit",
    }),
  });

  async ngOnInit(): Promise<void> {
    if (this.platformUtilsService.getClientType() === ClientType.Desktop) {
      this.messageListener
        .messages$(new CommandDefinition("windowHidden"))
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.showPassword = false;
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

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
