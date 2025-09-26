import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { concatMap, firstValueFrom, pairwise, startWith, Subject, takeUntil } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { VaultTimeoutAction } from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { SessionTimeoutConfirmationNeverComponent } from "./session-timeout-confirmation-never.component";

type SessionTimeoutAction = null | "lock" | "logOut";
type SessionTimeoutType =
  | null
  | "never"
  | "onAppRestart"
  | "onSystemLock"
  | "immediately"
  | "custom";

export class SessionTimeoutPolicy extends BasePolicyEditDefinition {
  name = "sessionTimeoutPolicyTitle";
  description = "sessionTimeoutPolicyDescription";
  type = PolicyType.MaximumVaultTimeout;
  component = SessionTimeoutPolicyComponent;
}

const DEFAULT_HOURS = 8;
const DEFAULT_MINUTES = 0;

@Component({
  templateUrl: "session-timeout.component.html",
  imports: [SharedModule],
})
export class SessionTimeoutPolicyComponent
  extends BasePolicyEditComponent
  implements OnInit, OnDestroy
{
  private destroy$ = new Subject<void>();

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
  skipTypeConfirmation = false;

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

  ngOnInit() {
    super.ngOnInit();

    this.data.markAllAsTouched();
    this.data.updateValueAndValidity();

    const typeControl = this.data.get("type")!;
    typeControl.valueChanges
      .pipe(
        concatMap(async (type) => {
          this.updateFormControls(type);
          return type;
        }),
        startWith(typeControl.value ?? null),
        pairwise(),
        concatMap(async ([previousType, newType]) => {
          await this.confirmTypeChange(previousType, newType);
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
    const minutes: number | null = this.policyResponse?.data?.minutes ?? null;
    const action: SessionTimeoutAction =
      this.policyResponse?.data?.action ?? (null satisfies SessionTimeoutAction);
    // For backward compatibility, the "type" field might not exist, hence we initialize it based on the presence of "minutes"
    const type: SessionTimeoutType =
      this.policyResponse?.data?.type ?? ((minutes ? "custom" : null) satisfies SessionTimeoutType);

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
    if (this.data.invalid) {
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
    };
  }

  private async confirmTypeChange(previousType: SessionTimeoutType, newType: SessionTimeoutType) {
    if (this.skipTypeConfirmation) {
      this.skipTypeConfirmation = false;
      return;
    }

    let confirmed = true;
    if (newType === "never") {
      const dialogRef = this.dialogService.open<boolean>(SessionTimeoutConfirmationNeverComponent, {
        disableClose: true,
      });

      confirmed = !!(await firstValueFrom(dialogRef.closed));
    } else if (newType === "onSystemLock") {
      confirmed = await this.dialogService.openSimpleDialog({
        type: "info",
        title: { key: "sessionTimeoutConfirmationOnSystemLockTitle" },
        content: { key: "sessionTimeoutConfirmationOnSystemLockDescription" },
        acceptButtonText: { key: "continue" },
        cancelButtonText: { key: "cancel" },
      });
    }

    if (!confirmed) {
      this.skipTypeConfirmation = true;
      this.data.patchValue({
        type: previousType,
      });
    }
  }

  private updateFormControls(type: SessionTimeoutType) {
    const hoursControl = this.data.get("hours")!;
    const minutesControl = this.data.get("minutes")!;
    if (type === "custom") {
      hoursControl.enable();
      minutesControl.enable();
    } else {
      hoursControl.disable();
      minutesControl.disable();
    }
  }
}
