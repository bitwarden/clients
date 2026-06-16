// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DatePipe } from "@angular/common";
import {
  Component,
  OnInit,
  input,
  output,
  effect,
  PipeTransform,
  Pipe,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
  ValidatorFn,
  ValidationErrors,
} from "@angular/forms";
import { combineLatest, map, startWith, switchMap, tap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
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
  CopyClickDirective,
  Option,
} from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendFormService } from "../../abstractions/send-form.service";
import { SendOptionsComponent } from "../options/send-options.component";

import { SendFileDetailsComponent } from "./send-file-details.component";
import { SendTextDetailsComponent } from "./send-text-details.component";

/** A preset duration (in hours) for deletion. */
export const DatePreset = Object.freeze({
  /** One-hour duration. */
  OneHour: 1,
  /** One-day duration (24 hours). */
  OneDay: 24,
  /** Two-day duration (48 hours). */
  TwoDays: 48,
  /** Three-day duration (72 hours). */
  ThreeDays: 72,
  /** Seven-day duration (168 hours). */
  SevenDays: 168,
  /** Fourteen-day duration (336 hours). */
  FourteenDays: 336,
  /** Thirty-day duration (720 hours). */
  ThirtyDays: 720,
} as const);

/** A preset duration (in hours) for deletion. */
export type DatePreset = (typeof DatePreset)[keyof typeof DatePreset];

const namesByDatePreset = new Map<DatePreset, keyof typeof DatePreset>(
  Object.entries(DatePreset).map(([k, v]) => [v as DatePreset, k as keyof typeof DatePreset]),
);

/**
 * Runtime type guard to verify a value is a valid DatePreset.
 */
export function isDatePreset(value: unknown): value is DatePreset {
  return namesByDatePreset.has(value as DatePreset);
}

/**
 * Safe converter to DatePreset (numeric preset), returns undefined for invalid inputs.
 */
export function asDatePreset(value: unknown): DatePreset | undefined {
  return isDatePreset(value) ? (value as DatePreset) : undefined;
}

/** The types of authorization that Sends are able to use */
const sendAuthTypes = Object.freeze([
  { nameKey: "noAuth", value: AuthType.None },
  { nameKey: "specificPeople", value: AuthType.Email },
  { nameKey: "anyOneWithPassword", value: AuthType.Password },
] as const);

@Pipe({
  name: "AuthTypeName",
})
export class AuthTypeNamePipe implements PipeTransform {
  constructor(private i18nSvc: I18nService) {}
  transform(value: number) {
    const authTypeWithValue = sendAuthTypes.find((a) => a.value === value);
    return authTypeWithValue
      ? this.i18nSvc.t(authTypeWithValue.nameKey)
      : this.i18nSvc.t("unknown");
  }
}

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
    AuthTypeNamePipe,
    I18nPipe,
    CopyClickDirective,
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
  readonly AuthType = AuthType;

  protected readonly editing = input<boolean>(false);

  readonly openPasswordGenerator = output<void>();

  datePresetOptions: Option<DatePreset | string>[] = [
    { label: this.i18nService.t("oneHour"), value: DatePreset.OneHour },
    { label: this.i18nService.t("oneDay"), value: DatePreset.OneDay },
    { label: this.i18nService.t("days", "2"), value: DatePreset.TwoDays },
    { label: this.i18nService.t("days", "3"), value: DatePreset.ThreeDays },
    { label: this.i18nService.t("days", "7"), value: DatePreset.SevenDays },
    { label: this.i18nService.t("days", "14"), value: DatePreset.FourteenDays },
    { label: this.i18nService.t("days", "30"), value: DatePreset.ThirtyDays },
  ];
  passwordRemoved = false;
  policyAllowedDomains: string[] | null = null;

  hasPremium$ = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    ),
  );

  private sendPolicyService = inject(SendPolicyService);

  availableAuthTypes$ = combineLatest([
    this.hasPremium$,
    this.sendPolicyService.whoCanAccess$,
  ]).pipe(
    map(([hasPremium, whoCanAccess]) => {
      const anyAuthTypeAllowed = whoCanAccess === WhoCanAccessType.Any || whoCanAccess === null;
      /** Show the email auth type if the feature flag is enabled AND EITHER
       * 1. There is an enterprise policy that mandates the email auth type
       * 2. There are no policies dictating required auth types
       * 3. The Send currently uses the email auth type */
      const originalSendView = this.sendFormService.originalSendView();
      const includeEmail =
        hasPremium &&
        (whoCanAccess === WhoCanAccessType.SpecificPeople ||
          anyAuthTypeAllowed ||
          originalSendView?.authType === AuthType.Email);
      /** Show the password auth type if EITHER
       * 1. There is an enterprise policy that mandates the password auth type
       * 2. There are no policies dictating required auth types
       * 3. The Send currently uses the password auth type */
      const includePassword =
        whoCanAccess === WhoCanAccessType.PasswordProtected ||
        anyAuthTypeAllowed ||
        originalSendView?.authType === AuthType.Password;
      /** Show the "Anyone with the link" auth type if EITHER
       * 1. There are no enterprise policies that dictate required auth types
       * 2. The Send currently uses the "Anyone with the link" auth type */
      const includeAny = anyAuthTypeAllowed || originalSendView?.authType === AuthType.None;
      return sendAuthTypes.filter(
        (at) =>
          (includeEmail && at.value === AuthType.Email) ||
          (includePassword && at.value === AuthType.Password) ||
          (includeAny && at.value === AuthType.None),
      );
    }),
  );

  sendDetailsForm = this.formBuilder.group({
    name: new FormControl(this.sendFormService.updatedSendView()?.name ?? "", Validators.required),
    selectedDeletionDatePreset: new FormControl<DatePreset | string>(
      this.sendFormService.updatedSendView()?.deletionDate?.toString() ?? DatePreset.SevenDays,
      Validators.required,
    ),
    authType: new FormControl<AuthType>(
      this.sendFormService.updatedSendView()?.authType ?? AuthType.None,
    ),
    password: new FormControl(this.originalHadPassword ? "************" : null),
    emails: new FormControl(this.sendFormService.updatedSendView()?.emails?.join(", ") ?? null),
  });

  get originalHadPassword(): boolean {
    return this.sendFormService.originalSendView()?.password != null;
  }

  constructor(
    protected formBuilder: FormBuilder,
    protected i18nService: I18nService,
    protected datePipe: DatePipe,
    protected environmentService: EnvironmentService,
    private accountService: AccountService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    protected sendFormService: SendFormService,
  ) {
    this.sendFormService.registerChildForm("sendDetailsForm", this.sendDetailsForm);
    // When we change editing state we want to update the password field's disabled status
    effect(() => {
      if (this.editing() && this.originalHadPassword) {
        this.sendDetailsForm.get("password").disable();
      } else {
        this.sendDetailsForm.get("password").enable();
      }
    });

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
      .valueChanges.pipe(
        startWith(this.sendFormService.updatedSendView()?.authType ?? AuthType.None),
        takeUntilDestroyed(),
      )
      .subscribe((type) => {
        const emailsControl = this.sendDetailsForm.get("emails");
        const passwordControl = this.sendDetailsForm.get("password");

        if (type === AuthType.Password) {
          emailsControl.setValue(null);
          emailsControl.clearValidators();
          if (this.originalHadPassword) {
            passwordControl.setValue("************");
          }
          passwordControl.setValidators([Validators.required]);
          if (this.editing() && this.originalHadPassword) {
            passwordControl.disable();
          }
        } else if (type === AuthType.Email) {
          passwordControl.setValue(null);
          passwordControl.clearValidators();
          emailsControl.setValidators([
            Validators.required,
            this.emailsMaxLengthValidator(),
            this.emailListValidator(),
          ]);
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

    const emailsControl = this.sendDetailsForm.get("emails");
    emailsControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (typeof value === "string" && value.length >= 2500) {
        // bitInput's input handler marks the control untouched on every keystroke
        // (input.directive.ts), which hides bit-error. Defer to the next macrotask
        // so markAsTouched lands after that, surfacing the cap-reached error while
        // the user is still in the field.
        setTimeout(() => emailsControl.markAsTouched(), 0);
      }
    });

    effect(() => {
      if (!this.editing()) {
        if (this.sendFormService.originalSendView()) {
          this.initializeFormFromOriginal(this.sendFormService.originalSendView());
        }
      }
    });

    this.sendFormService.registerChildForm("sendDetailsForm", this.sendDetailsForm);
  }

  async ngOnInit() {
    const updatedSendView = this.sendFormService.updatedSendView();

    if (this.originalHadPassword) {
      this.sendDetailsForm.get("password")?.disable();
    }

    if (updatedSendView.deletionDate) {
      this.datePresetOptions.unshift({
        label: this.datePipe.transform(updatedSendView.deletionDate, "short"),
        value: updatedSendView.deletionDate.toString(),
      });
    }

    if (!this.sendFormService.sendFormConfig.areSendsAllowed) {
      this.sendDetailsForm.disable();
    }
  }

  private initializeFormFromOriginal(originalSendView: SendView) {
    this.sendDetailsForm.patchValue({
      name: originalSendView.name,
      selectedDeletionDatePreset: originalSendView.deletionDate.toString(),
      password: this.originalHadPassword ? "************" : null,
      authType: originalSendView.authType,
      emails: originalSendView.emails?.join(", ") ?? null,
    });
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

  emailsMaxLengthValidator(): ValidatorFn {
    return (control: FormControl): ValidationErrors | null => {
      if (typeof control.value !== "string" || control.value.length < 2500) {
        return null;
      }
      return {
        emailsMaxLength: {
          message: this.i18nService.t("sendEmailsCharacterLimitReached"),
        },
      };
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
    const removed = await this.sendFormService.removeSendPassword();
    if (removed) {
      this.passwordRemoved = true;
      this.sendDetailsForm.patchValue({
        authType: AuthType.None,
        password: null,
      });
    }
  };
}
