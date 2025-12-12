import { CommonModule } from "@angular/common";
import { Component, DestroyRef, inject, input, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
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
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  pairwise,
  startWith,
  switchMap,
  tap,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ClientType } from "@bitwarden/client-type";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { MaximumSessionTimeoutPolicyData } from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutAction,
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

import { SessionTimeoutSettingsComponentService } from "../services/session-timeout-settings-component.service";

import { SessionTimeoutInputComponent } from "./session-timeout-input.component";

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
    SessionTimeoutInputComponent,
  ],
})
export class SessionTimeoutSettingsComponent implements OnInit {
  // TODO remove once https://bitwarden.atlassian.net/browse/PM-27283 is completed
  //  This is because vaultTimeoutSettingsService.availableVaultTimeoutActions$ is not reactive, hence the change detection
  //  needs to be manually triggered to refresh available timeout actions
  readonly refreshTimeoutActionSettings = input<Observable<void>>(
    new BehaviorSubject<void>(undefined),
  );

  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly sessionTimeoutSettingsComponentService = inject(
    SessionTimeoutSettingsComponentService,
  );
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly policyService = inject(PolicyService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  formGroup = new FormGroup({
    timeout: new FormControl<VaultTimeout | null>(null, [Validators.required]),
    timeoutAction: new FormControl<VaultTimeoutAction>(VaultTimeoutAction.Lock, [
      Validators.required,
    ]),
  });
  protected readonly availableTimeoutActions = signal<VaultTimeoutAction[]>([]);
  protected readonly availableTimeoutOptions$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.sessionTimeoutSettingsComponentService.policyFilteredTimeoutOptions$(userId),
    ),
    tap((options) => {
      this.logService.debug("[SessionTimeoutSettings] Available timeout options", options);
    }),
  );
  protected readonly sessionTimeoutActionFromPolicy$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.MaximumVaultTimeout, userId),
    ),
    getFirstPolicy,
    map((policy) => policy?.data as MaximumSessionTimeoutPolicyData | undefined),
    map((data) => data?.action ?? null),
  );
  protected readonly sessionTimeoutActionFromPolicy = toSignal(
    this.sessionTimeoutActionFromPolicy$,
  );

  private userId!: UserId;

  get canLock() {
    return this.availableTimeoutActions().includes(VaultTimeoutAction.Lock);
  }

  get supportsLock() {
    return (
      this.platformUtilsService.getClientType() !== ClientType.Web &&
      this.sessionTimeoutActionFromPolicy() !== "logOut"
    );
  }

  async ngOnInit(): Promise<void> {
    this.userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const timeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(this.userId),
    );

    this.formGroup.patchValue(
      {
        timeout: timeout,
        timeoutAction: await firstValueFrom(
          this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(this.userId),
        ),
      },
      { emitEvent: false },
    );

    // Sync form with reactive timeout updates to handle race condition where policies
    // load asynchronously and may override the initially set timeout value
    this.vaultTimeoutSettingsService
      .getVaultTimeoutByUserId$(this.userId)
      .pipe(
        filter((timeout) => this.formGroup.controls.timeout.value !== timeout),
        tap((timeout) =>
          this.logService.debug(
            `[SessionTimeoutSettings] Updating initial form timeout from ${this.formGroup.controls.timeout.value} to ${timeout}`,
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((timeout) => {
        this.formGroup.controls.timeout.setValue(timeout, { emitEvent: false });
      });

    this.refreshTimeoutActionSettings()
      .pipe(
        startWith(undefined),
        switchMap(() =>
          combineLatest([
            this.vaultTimeoutSettingsService.availableVaultTimeoutActions$(this.userId),
            this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(this.userId),
            this.sessionTimeoutActionFromPolicy$,
          ]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([availableActions, action, sessionTimeoutActionFromPolicy]) => {
        this.availableTimeoutActions.set(availableActions);
        this.formGroup.controls.timeoutAction.setValue(action, { emitEvent: false });

        // Enable/disable the action control based on policy or available actions
        if (sessionTimeoutActionFromPolicy != null || availableActions.length <= 1) {
          this.formGroup.controls.timeoutAction.disable({ emitEvent: false });
        } else {
          this.formGroup.controls.timeoutAction.enable({ emitEvent: false });
        }
      });

    this.formGroup.controls.timeout.valueChanges
      .pipe(
        startWith(timeout), // emit to init pairwise
        filter((value) => value != null),
        distinctUntilChanged(),
        pairwise(),
        concatMap(async ([previousValue, newValue]) => {
          await this.saveTimeout(previousValue, newValue);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.formGroup.controls.timeoutAction.valueChanges
      .pipe(
        filter((value) => value != null),
        map(async (value) => {
          await this.saveTimeoutAction(value);
        }),
        takeUntilDestroyed(this.destroyRef),
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

    this.sessionTimeoutSettingsComponentService.onTimeoutSave(newValue);
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
}
