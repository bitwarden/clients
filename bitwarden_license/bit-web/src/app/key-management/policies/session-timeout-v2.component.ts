import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  BehaviorSubject,
  concatMap,
  firstValueFrom,
  Subject,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  MaximumSessionTimeoutPolicyData,
  SessionTimeoutAction,
  SessionTimeoutType,
} from "@bitwarden/common/key-management/session-timeout";
import { VaultTimeoutAction } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CalloutComponent,
  DialogService,
  FormControlModule,
  FormFieldModule,
  SelectModule,
  SwitchComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  BasePolicyEditComponent,
  BasePolicyEditDefinition,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";

import { SessionTimeoutConfirmationNeverComponent } from "./session-timeout-confirmation-never.component";

export class SessionTimeoutPolicyV2 extends BasePolicyEditDefinition {
  name = "sessionTimeoutPolicyTitle";
  description = "sessionTimeoutPolicyDescription";
  type = PolicyType.MaximumVaultTimeout;
  category = PolicyCategory.Authentication;
  priority = 70;
  component = SessionTimeoutPolicyV2Component;
  showDescription = false;
  showEnabledBadge = true;

  display$(_organization: Organization, configService: ConfigService) {
    return configService.getFeatureFlag$(FeatureFlag.PolicyDrawers);
  }
}

const DEFAULT_HOURS = 8;
const DEFAULT_MINUTES = 0;

@Component({
  selector: "session-timeout-policy-v2-edit",
  templateUrl: "session-timeout-v2.component.html",
  imports: [
    CalloutComponent,
    FormControlModule,
    FormFieldModule,
    ReactiveFormsModule,
    SelectModule,
    SwitchComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionTimeoutPolicyV2Component
  extends BasePolicyEditComponent
  implements OnInit, OnDestroy
{
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly dialogService = inject(DialogService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly actionOptions: { name: string; value: SessionTimeoutAction }[] = [
    { name: this.i18nService.t("userPreference"), value: null },
    { name: this.i18nService.t("lock"), value: VaultTimeoutAction.Lock },
    { name: this.i18nService.t("logOut"), value: VaultTimeoutAction.LogOut },
  ];

  readonly typeOptions: { name: string; value: SessionTimeoutType }[] = [
    { name: this.i18nService.t("immediately"), value: "immediately" },
    { name: this.i18nService.t("custom"), value: "custom" },
    { name: this.i18nService.t("onSystemLock"), value: "onSystemLock" },
    { name: this.i18nService.t("onAppRestart"), value: "onAppRestart" },
    { name: this.i18nService.t("never"), value: "never" },
  ];

  readonly data = this.formBuilder.group({
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

  private readonly destroy$ = new Subject<void>();
  private readonly lastConfirmedType$ = new BehaviorSubject<SessionTimeoutType>(null);

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
            this.cdr.markForCheck();
          } else {
            typeControl.setValue(lastConfirmedType, { emitEvent: false });
            this.cdr.markForCheck();
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

  private get policyData(): MaximumSessionTimeoutPolicyData | null {
    return this.policyResponse()?.data ?? null;
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
