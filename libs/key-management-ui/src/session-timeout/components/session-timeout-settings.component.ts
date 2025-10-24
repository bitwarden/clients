import { CommonModule } from "@angular/common";
import { Component, inject, input, OnInit, output, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterModule } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  pairwise,
  startWith,
  switchMap,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultTimeoutInputComponent } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ClientType } from "@bitwarden/common/enums";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutOption,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  ItemModule,
  LinkModule,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-session-timeout-settings",
  templateUrl: "session-timeout-settings.component.html",
  imports: [
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    IconButtonModule,
    ItemModule,
    JslibModule,
    LinkModule,
    RouterModule,
    SelectModule,
    TypographyModule,
    VaultTimeoutInputComponent,
  ],
})
export class SessionTimeoutSettingsComponent implements OnInit {
  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly policyService = inject(PolicyService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly logService = inject(LogService);

  readonly excludeTimeoutTypes = input.required<VaultTimeout[]>();
  readonly refreshTimeoutActionSettings = input<Observable<void>>(
    new BehaviorSubject<void>(undefined),
  );

  readonly onTimeoutSave = output<VaultTimeout>();

  protected readonly availableVaultTimeoutActions = signal<VaultTimeoutAction[]>([]);
  protected readonly vaultTimeoutOptions = signal<VaultTimeoutOption[]>([]);
  protected hasVaultTimeoutPolicy$: Observable<boolean> = of(false);

  private userId!: UserId;

  formGroup = new FormGroup({
    timeout: new FormControl<VaultTimeout | null>(null, [Validators.required]),
    timeoutAction: new FormControl<VaultTimeoutAction>(VaultTimeoutAction.Lock, [
      Validators.required,
    ]),
  });

  get canLock() {
    return this.availableVaultTimeoutActions().includes(VaultTimeoutAction.Lock);
  }

  async ngOnInit(): Promise<void> {
    this.vaultTimeoutOptions.set(this.getTimeoutOptions());

    this.logService.debug(
      "[SessionTimeoutSettings] Available timeout options",
      this.vaultTimeoutOptions(),
    );

    this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const maximumVaultTimeoutPolicy$ = this.policyService
      .policiesByType$(PolicyType.MaximumVaultTimeout, this.userId)
      .pipe(getFirstPolicy);

    this.hasVaultTimeoutPolicy$ = maximumVaultTimeoutPolicy$.pipe(map((policy) => policy != null));

    let timeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(this.userId),
    );

    // Fallback if current timeout option is not available on this platform
    // Only applies to string-based timeout types, not numeric values
    const hasCurrentOption = this.vaultTimeoutOptions().some((opt) => opt.value === timeout);
    if (!hasCurrentOption && typeof timeout !== "number") {
      this.logService.debug(
        "[SessionTimeoutSettings] Current timeout option not available, falling back from",
        { timeout },
      );
      timeout = VaultTimeoutStringType.OnRestart;
    }

    this.formGroup.patchValue(
      {
        timeout: timeout,
        timeoutAction: await firstValueFrom(
          this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(this.userId),
        ),
      },
      { emitEvent: false },
    );

    this.refreshTimeoutActionSettings()
      .pipe(
        startWith(undefined),
        switchMap(() =>
          combineLatest([
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(this.userId),
            this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(this.userId),
            maximumVaultTimeoutPolicy$,
          ]),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(([availableActions, action, policy]) => {
        this.availableVaultTimeoutActions.set(availableActions);
        this.formGroup.controls.timeoutAction.setValue(action, { emitEvent: false });

        // Enable/disable the action control based on policy or available actions
        if (policy?.data?.action || availableActions.length <= 1) {
          this.formGroup.controls.timeoutAction.disable({ emitEvent: false });
        } else {
          this.formGroup.controls.timeoutAction.enable({ emitEvent: false });
        }
      });

    this.formGroup.controls.timeout.valueChanges
      .pipe(
        startWith(timeout), // emit to init pairwise
        filter((value) => value != null),
        pairwise(),
        concatMap(async ([previousValue, newValue]) => {
          await this.saveTimeout(previousValue, newValue);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.formGroup.controls.timeoutAction.valueChanges
      .pipe(
        filter((value) => value != null),
        map(async (value) => {
          await this.saveTimeoutAction(value);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  async saveTimeout(previousValue: VaultTimeout, newValue: VaultTimeout) {
    this.formGroup.controls.timeout.markAllAsTouched();
    if (this.formGroup.controls.timeout.invalid) {
      return;
    }

    this.logService.debug("[SessionTimeoutSettings] Saving timeout", { previousValue, newValue });

    if (newValue === VaultTimeoutStringType.Never) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: "warning",
      });

      if (!confirmed) {
        this.formGroup.controls.timeout.setValue(previousValue, { emitEvent: false });
        return;
      }
    }

    const vaultTimeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(this.userId),
    );

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      this.userId,
      newValue,
      vaultTimeoutAction,
    );

    this.onTimeoutSave.emit(newValue);
  }

  async saveTimeoutAction(value: VaultTimeoutAction) {
    this.logService.debug("[SessionTimeoutSettings] Saving timeout action", value);

    if (value === VaultTimeoutAction.LogOut) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "vaultTimeoutLogOutConfirmationTitle" },
        content: { key: "vaultTimeoutLogOutConfirmation" },
        type: "warning",
      });

      if (!confirmed) {
        this.formGroup.controls.timeoutAction.setValue(VaultTimeoutAction.Lock, {
          emitEvent: false,
        });
        return;
      }
    }

    if (this.formGroup.controls.timeout.hasError("policyError")) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("vaultTimeoutTooLarge"),
      });
      return;
    }

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      this.userId,
      this.formGroup.controls.timeout.value!,
      value,
    );
  }

  private getTimeoutOptions(): VaultTimeoutOption[] {
    const clientType = this.platformUtilsService.getClientType();

    // Generate all possible timeout options
    const allOptions: VaultTimeoutOption[] = [
      { name: this.i18nService.t("immediately"), value: 0 },
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
      { name: this.i18nService.t("onIdle"), value: VaultTimeoutStringType.OnIdle },
      { name: this.i18nService.t("onSleep"), value: VaultTimeoutStringType.OnSleep },
      { name: this.i18nService.t("onLocked"), value: VaultTimeoutStringType.OnLocked },
      {
        name: this.i18nService.t(clientType === ClientType.Web ? "onRefresh" : "onRestart"),
        value: VaultTimeoutStringType.OnRestart,
      },
      { name: this.i18nService.t("never"), value: VaultTimeoutStringType.Never },
    ];

    // Filter out excluded timeout types
    return allOptions.filter((option) => !this.excludeTimeoutTypes().includes(option.value));
  }
}
