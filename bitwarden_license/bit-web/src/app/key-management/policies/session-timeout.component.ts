import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import {
  BehaviorSubject,
  concatMap,
  firstValueFrom,
  Subject,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  MaximumSessionTimeoutPolicyData,
  SessionTimeoutAction,
  SessionTimeoutType,
} from "@bitwarden/common/key-management/session-timeout";
import { VaultTimeoutAction } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";
import {
  BasePolicyEditComponent,
  BasePolicyEditDefinition,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { SessionTimeoutConfirmationNeverComponent } from "./session-timeout-confirmation-never.component";

export class SessionTimeoutPolicy extends BasePolicyEditDefinition {
  name = "sessionTimeoutPolicyTitle";
  description = "sessionTimeoutPolicyDescription";
  type = PolicyType.MaximumVaultTimeout;
  component = SessionTimeoutPolicyComponent;
}

const DEFAULT_HOURS = 8;
const DEFAULT_MINUTES = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "session-timeout.component.html",
  imports: [SharedModule],
})
export class SessionTimeoutPolicyComponent
  extends BasePolicyEditComponent
  implements OnInit, OnDestroy
{
  actionOptions: { name: string; value: SessionTimeoutAction }[];
  typeOptions: { name: string; value: SessionTimeoutType }[];
  data = this.formBuilder.group({
    type: new FormControl<SessionTimeoutType>(null, [Validators.required]),
    hours: new FormControl<number>(
      {
        value: DEFAULT_HOURS,
        disabled: true,
      },
      [Validators.required],
    ),
    minutes: new FormControl<number>(
      {
        value: DEFAULT_MINUTES,
        disabled: true,
      },
      [Validators.required],
    ),
    action: new FormControl<SessionTimeoutAction>(null),
  });

  private destroy$ = new Subject<void>();
  private lastConfirmedType$ = new BehaviorSubject<SessionTimeoutType>(null);

  constructor(
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private dialogService: DialogService,
  ) {
    super();
    this.actionOptions = [
      { name: i18nService.t("userPreference"), value: null },
      { name: i18nService.t("lock"), value: VaultTimeoutAction.Lock },
      { name: i18nService.t("logOut"), value: VaultTimeoutAction.LogOut },
    ];
    this.typeOptions = [
      { name: i18nService.t("immediately"), value: "immediately" },
      { name: i18nService.t("custom"), value: "custom" },
      { name: i18nService.t("onSystemLock"), value: "onSystemLock" },
      { name: i18nService.t("onAppRestart"), value: "onAppRestart" },
      { name: i18nService.t("never"), value: "never" },
    ];
  }

  get policyData(): MaximumSessionTimeoutPolicyData | null {
    return this.policyResponse?.data ?? null;
  }

  ngOnInit() {
    super.ngOnInit();

    const typeControl = this.data.controls.type;
    this.lastConfirmedType$.next(typeControl.value ?? null);

    typeControl.valueChanges
      .pipe(
        withLatestFrom(this.lastConfirmedType$),
        concatMap(async ([newType, lastConfirmedType]) => {
          const confirmed = await this.confirmTypeChange(newType);
          if (confirmed) {
            this.updateFormControls(newType);
            this.lastConfirmedType$.next(newType);
          } else {
            typeControl.setValue(lastConfirmedType, { emitEvent: false });
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected override loadData() {
    const minutes: number | null = this.policyData?.minutes ?? null;
    const action: SessionTimeoutAction = this.policyData?.action ?? null;
    // For backward compatibility, the "type" field might not exist, hence we initialize it based on the presence of "minutes"
    const type: SessionTimeoutType = this.policyData?.type ?? (minutes ? "custom" : null);

    this.updateFormControls(type);
    this.data.patchValue({
      type: type,
      hours: minutes ? Math.floor(minutes / 60) : DEFAULT_HOURS,
      minutes: minutes ? minutes % 60 : DEFAULT_MINUTES,
      action: action,
    });
  }

  protected override buildRequestData() {
    this.data.markAllAsTouched();
    this.data.updateValueAndValidity();
    if (this.data.invalid) {
      if (this.data.controls.type.hasError("required")) {
        throw new Error(this.i18nService.t("maximumAllowedTimeoutRequired"));
      }
      throw new Error(this.i18nService.t("sessionTimeoutPolicyInvalidTime"));
    }

    let minutes = this.data.value.hours! * 60 + this.data.value.minutes!;

    const type = this.data.value.type;
    if (type === "custom") {
      if (minutes <= 0) {
        throw new Error(this.i18nService.t("sessionTimeoutPolicyInvalidTime"));
      }
    } else {
      // For backwards compatibility, we set minutes to 8 hours, so older client's vault timeout will not be broken
      minutes = DEFAULT_HOURS * 60 + DEFAULT_MINUTES;
    }

    return {
      type,
      minutes,
      action: this.data.value.action,
    } satisfies MaximumSessionTimeoutPolicyData;
  }

  private async confirmTypeChange(newType: SessionTimeoutType): Promise<boolean> {
    if (newType === "never") {
      const dialogRef = SessionTimeoutConfirmationNeverComponent.open(this.dialogService);
      return !!(await firstValueFrom(dialogRef.closed));
    } else if (newType === "onSystemLock") {
      return await this.dialogService.openSimpleDialog({
        type: "info",
        title: { key: "sessionTimeoutConfirmationOnSystemLockTitle" },
        content: { key: "sessionTimeoutConfirmationOnSystemLockDescription" },
        acceptButtonText: { key: "continue" },
        cancelButtonText: { key: "cancel" },
      });
    }

    return true;
  }

  private updateFormControls(type: SessionTimeoutType) {
    const hoursControl = this.data.controls.hours;
    const minutesControl = this.data.controls.minutes;
    if (type === "custom") {
      hoursControl.enable();
      minutesControl.enable();
    } else {
      hoursControl.disable();
      minutesControl.disable();
    }
  }
}
