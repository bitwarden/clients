// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DatePipe } from "@angular/common";
import { Component, OnInit, Input, inject, output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
  ValidatorFn,
  ValidationErrors,
} from "@angular/forms";
import { firstValueFrom, combineLatest, map, switchMap, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import {
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  CheckboxModule,
  SelectModule,
  AsyncActionsModule,
  ButtonModule,
  ToastService,
  DialogService,
} from "@bitwarden/components";
import { SendFormConfig, SendFormGenerationService, SendPolicyService } from "@bitwarden/send-ui";

import {
  DatePreset,
  DatePresetSelectOption,
  isDatePreset,
  asDatePreset,
} from "../../../models/date-preset";
import { SendFormService } from "../../abstractions/send-form.service";
import { SendOptionsComponent } from "../options/send-options.component";

import { SendFileDetailsComponent } from "./send-file-details.component";
import { SendTextDetailsComponent } from "./send-text-details.component";

export {
  DatePreset,
  DatePresetSelectOption,
  isDatePreset,
  asDatePreset,
} from "../../../models/date-preset";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-send-details",
  templateUrl: "./send-details.component.html",
  standalone: true,
  imports: [
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    JslibModule,
    CardComponent,
    FormFieldModule,
    ReactiveFormsModule,
    SendTextDetailsComponent,
    SendFileDetailsComponent,
    SendOptionsComponent,
    IconButtonModule,
    CheckboxModule,
    CommonModule,
    CommonModule,
    SelectModule,
    AsyncActionsModule,
    ButtonModule,
  ],
})
export class SendDetailsComponent implements OnInit {
  readonly SendType = SendType;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() config: SendFormConfig;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() originalSendView?: SendView;

  readonly openPasswordGenerator = output<void>();

  FileSendType = SendType.File;
  TextSendType = SendType.Text;
  readonly AuthType = AuthType;
  sendLink: string | null = null;
  customDeletionDateOption: DatePresetSelectOption | null = null;
  datePresetOptions: DatePresetSelectOption[] = [];
  passwordRemoved = false;
  policyAllowedDomains: string[] | null = null;
  policyDeletionHours: DatePreset | null = null;
  policyDeletionHoursOrgName: string | null = null;

  emailVerificationFeatureFlag$ = this.configService.getFeatureFlag$(FeatureFlag.SendEmailOTP);
  hasPremium$ = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ),
  );

  authTypes: { name: string; value: AuthType; disabled?: boolean }[] = [
    { name: this.i18nService.t("noAuth"), value: AuthType.None },
    { name: this.i18nService.t("specificPeople"), value: AuthType.Email },
    { name: this.i18nService.t("anyOneWithPassword"), value: AuthType.Password },
  ];

  private sendPolicyService = inject(SendPolicyService);

  availableAuthTypes$ = combineLatest([
    this.emailVerificationFeatureFlag$,
    this.hasPremium$,
    this.sendPolicyService.whoCanAccess$,
  ]).pipe(
    map(([enabled, hasPremium, whoCanAccess]) => {
      const anyAuthTypeAllowed = whoCanAccess === WhoCanAccessType.Any || whoCanAccess === null;
      /** Show the email auth type if the feature flag is enabled AND EITHER
       * 1. There is an enterprise policy that mandates the email auth type
       * 2. There are no policies dictating required auth types
       * 3. The Send currently uses the email auth type */
      const includeEmail =
        enabled &&
        hasPremium &&
        (whoCanAccess === WhoCanAccessType.SpecificPeople ||
          anyAuthTypeAllowed ||
          this.originalSendView?.authType === AuthType.Email);
      /** Show the password auth type if EITHER
       * 1. There is an enterprise policy that mandates the password auth type
       * 2. There are no policies dictating required auth types
       * 3. The Send currently uses the password auth type */
      const includePassword =
        whoCanAccess === WhoCanAccessType.PasswordProtected ||
        anyAuthTypeAllowed ||
        this.originalSendView?.authType === AuthType.Password;
      /** Show the "Anyone with the link" auth type if EITHER
       * 1. There are no enterprise policies that dictate required auth types
       * 2. The Send currently uses the "Anyone with the link" auth type */
      const includeAny = anyAuthTypeAllowed || this.originalSendView?.authType === AuthType.None;
      return this.authTypes.filter(
        (at) =>
          (includeEmail && at.value === AuthType.Email) ||
          (includePassword && at.value === AuthType.Password) ||
          (includeAny && at.value === AuthType.None),
      );
    }),
  );

  sendDetailsForm = this.formBuilder.group({
    name: new FormControl("", Validators.required),
    selectedDeletionDatePreset: new FormControl(DatePreset.SevenDays || "", Validators.required),
    authType: [AuthType.None as AuthType],
    password: [null as string],
    emails: [null as string],
  });

  get hasPassword(): boolean {
    return this.sendFormService.originalSendView?.password != null;
  }

  constructor(
    protected formBuilder: FormBuilder,
    protected i18nService: I18nService,
    protected datePipe: DatePipe,
    protected environmentService: EnvironmentService,
    private configService: ConfigService,
    private accountService: AccountService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private sendApiService: SendApiService,
    private dialogService: DialogService,
    private toastService: ToastService,
    protected sendFormService: SendFormService,
    private sendFormGenerationService: SendFormGenerationService,
  ) {
    this.sendDetailsForm.valueChanges
      .pipe(
        tap((value) => {
          if (Utils.isNullOrWhitespace(value.password)) {
            value.password = null;
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe((value) => {
        this.sendFormService.patchSend((send) => {
          return Object.assign(send, {
            name: value.name,
            deletionDate: new Date(this.formattedDeletionDate),
            expirationDate: new Date(this.formattedDeletionDate),
            password: value.password,
            authType: value.authType,
            emails: value.emails
              ? value.emails
                  .split(",")
                  .map((e) => e.trim())
                  .filter((e) => e.length > 0)
              : [],
          } as unknown as SendView);
        });
      });

    this.sendDetailsForm
      .get("authType")
      .valueChanges.pipe(takeUntilDestroyed())
      .subscribe((type) => {
        const emailsControl = this.sendDetailsForm.get("emails");
        const passwordControl = this.sendDetailsForm.get("password");

        if (type === AuthType.Password) {
          emailsControl.setValue(null);
          emailsControl.clearValidators();
          passwordControl.setValidators([Validators.required]);
        } else if (type === AuthType.Email) {
          passwordControl.setValue(null);
          passwordControl.clearValidators();
          emailsControl.setValidators([Validators.required, this.emailListValidator()]);
        } else {
          emailsControl.setValue(null);
          emailsControl.clearValidators();
          passwordControl.setValue(null);
          passwordControl.clearValidators();
        }
        emailsControl.updateValueAndValidity();
        passwordControl.updateValueAndValidity();
      });

    this.sendPolicyService.allowedDomains$
      .pipe(takeUntilDestroyed())
      .subscribe((allowedDomains) => {
        const emailsControl = this.sendDetailsForm.get("emails");
        if (allowedDomains && allowedDomains.length > 0) {
          this.policyAllowedDomains = allowedDomains;
        } else {
          this.policyAllowedDomains = null;
        }
        emailsControl.updateValueAndValidity();
      });

    combineLatest([
      this.sendPolicyService.deletionHours$,
      this.sendPolicyService.deletionHoursOrgName$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([deletionHours, orgName]) => {
        this.policyDeletionHours = deletionHours;
        this.policyDeletionHoursOrgName = orgName;
        const deletionControl = this.sendDetailsForm.get("selectedDeletionDatePreset");
        if (deletionHours != null) {
          deletionControl.setValue(deletionHours as any);
          deletionControl.disable();
        }
      });
    this.sendFormService.registerChildForm("sendDetailsForm", this.sendDetailsForm);
  }

  async ngOnInit() {
    this.setupDeletionDatePresets();

    if (this.sendFormService.originalSendView) {
      this.sendDetailsForm.patchValue({
        name: this.sendFormService.originalSendView.name,
        selectedDeletionDatePreset: this.sendFormService.originalSendView.deletionDate.toString(),
        password: this.hasPassword ? "************" : null,
        authType: this.sendFormService.originalSendView.authType,
        emails: this.sendFormService.originalSendView.emails?.join(", ") ?? null,
      });

      if (this.hasPassword) {
        this.sendDetailsForm.get("password")?.disable();
      }

      if (this.sendFormService.originalSendView.deletionDate) {
        this.customDeletionDateOption = {
          name: this.datePipe.transform(
            this.sendFormService.originalSendView.deletionDate,
            "short",
          ),
          value: this.sendFormService.originalSendView.deletionDate.toString(),
        };
        this.datePresetOptions.unshift(this.customDeletionDateOption);
      }

      const env = await firstValueFrom(this.environmentService.environment$);
      this.sendLink =
        env.getSendUrl() +
        this.sendFormService.originalSendView.accessId +
        "/" +
        this.sendFormService.originalSendView.urlB64Key;
    }

    if (!this.sendFormService.sendFormConfig.areSendsAllowed) {
      this.sendDetailsForm.disable();
    }

    if (this.originalSendView?.disabled) {
      this.sendDetailsForm.disable();
    }
  }

  setupDeletionDatePresets() {
    const defaultSelections: DatePresetSelectOption[] = [
      { name: this.i18nService.t("oneHour"), value: DatePreset.OneHour },
      { name: this.i18nService.t("oneDay"), value: DatePreset.OneDay },
      { name: this.i18nService.t("days", "2"), value: DatePreset.TwoDays },
      { name: this.i18nService.t("days", "3"), value: DatePreset.ThreeDays },
      { name: this.i18nService.t("days", "7"), value: DatePreset.SevenDays },
      { name: this.i18nService.t("days", "14"), value: DatePreset.FourteenDays },
      { name: this.i18nService.t("days", "30"), value: DatePreset.ThirtyDays },
    ];

    this.datePresetOptions = defaultSelections;
  }

  get formattedDeletionDate(): string {
    const now = new Date();
    const selectedValue = this.sendDetailsForm.controls.selectedDeletionDatePreset.value;

    // The form allows for custom date strings, if such is used, return it without worrying about DatePreset validation
    if (typeof selectedValue === "string") {
      return selectedValue;
    }

    // Otherwise, treat it as a preset and validate at runtime
    const preset = asDatePreset(selectedValue);
    if (!isDatePreset(preset)) {
      return new Date(now).toString();
    }

    const milliseconds = now.setTime(now.getTime() + preset * 60 * 60 * 1000);
    return new Date(milliseconds).toString();
  }

  emailListValidator(): ValidatorFn {
    return (control: FormControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const emails = control.value.split(",").map((e: string) => e.trim());
      const nonEmptyEmails = emails.filter((e: string) => e.length > 0);
      if (nonEmptyEmails.length === 0) {
        return { required: true };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = nonEmptyEmails.filter((e: string) => !emailRegex.test(e));
      if (invalidEmails.length > 0) {
        return { multipleEmails: true };
      }

      if (this.policyAllowedDomains && this.policyAllowedDomains.length > 0) {
        const disallowedEmails = nonEmptyEmails.filter((email: string) => {
          const domain = email.split("@")[1]?.toLowerCase();
          return !this.policyAllowedDomains.includes(domain);
        });
        if (disallowedEmails.length > 0) {
          return {
            domainNotAllowed: {
              value: control.value,
              domains: this.policyAllowedDomains.join(", "),
              message: this.i18nService.t("domainNotAllowed", this.policyAllowedDomains.join(", ")),
            },
          };
        }
      }

      return null;
    };
  }

  generatePassword = () => {
    this.openPasswordGenerator.emit();
  };

  /**
   * Sets the password field with a generated value from the inline generator.
   */
  setGeneratedPassword(value: string) {
    this.sendDetailsForm.patchValue({
      password: value,
    });
  }

  removePassword = async () => {
    if (!this.hasPassword) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removePassword" },
      content: { key: "removePasswordConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    this.passwordRemoved = true;

    await this.sendApiService.removePassword(this.sendFormService.originalSendView.id);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("removedPassword"),
    });

    this.sendFormService.originalSendView.password = null;
    this.sendDetailsForm.patchValue({
      password: null,
    });
    this.sendDetailsForm.get("password")?.enable();
  };
}
