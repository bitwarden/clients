import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";
import { map, startWith, switchMap } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitFormFieldComponent,
  CheckboxModule,
  FormFieldModule,
  TypographyModule,
  IconComponent,
  TooltipDirective,
  CalloutComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

function lengthValidCustomMessage(customMessage: string, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value && control.value.length > max) {
      return { maxLength: { message: customMessage } };
    }
    return null;
  };
}

function requiredCustomMessage(customMessage: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    return control.value?.trim() ? null : { requiredCustom: { message: customMessage } };
  };
}

export class OrganizationUserNotificationPolicy extends BasePolicyEditDefinition {
  name = "organizationUserNotificationPolicyTitle";
  description = "organizationUserNotificationPolicyDesc";
  type = PolicyType.OrganizationUserNotification;
  component = OrganizationUserNotificationPolicyComponent;
  category = PolicyCategory.VaultManagement;
  priority = 70;

  display$(organization: Organization, configService: ConfigService) {
    return configService.getFeatureFlag$(FeatureFlag.PM31948_OrgUserNotificationBanner);
  }
}

interface OrganizationUserNotificationPolicyOptions {
  header: string | null;
  description: string | null;
  buttonText: string | null;
  showAfterEveryLogin: boolean | null;
}

// Policy Component Class
@Component({
  templateUrl: "organization-user-notification-policy.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitFormFieldComponent,
    CheckboxModule,
    FormFieldModule,
    ReactiveFormsModule,
    TypographyModule,
    IconComponent,
    TooltipDirective,
    CalloutComponent,
    I18nPipe,
  ],
})
export class OrganizationUserNotificationPolicyComponent extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly policyService = inject(PolicyService);
  private readonly i18nService = inject(I18nService);

  private readonly singleOrgEnabled$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policies$(userId)),
    map((policies) => policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false),
  );

  protected readonly singleOrgEnabled = toSignal(this.singleOrgEnabled$, { initialValue: false });

  // Component implementation
  readonly data: FormGroup<ControlsOf<OrganizationUserNotificationPolicyOptions>> =
    this.formBuilder.group({
      header: [
        null as string | null,
        lengthValidCustomMessage(
          this.i18nService.t(
            "tooManyCharacters",
            this.i18nService.t("header").toLocaleLowerCase(),
            40,
          ),
          40,
        ),
      ],
      description: [
        null as string | null,
        [
          requiredCustomMessage(this.i18nService.t("enterADescription")),
          lengthValidCustomMessage(
            this.i18nService.t(
              "tooManyCharacters",
              this.i18nService.t("description").toLocaleLowerCase(),
              250,
            ),
            250,
          ),
        ],
      ],
      buttonText: [
        null as string | null,
        [
          lengthValidCustomMessage(
            this.i18nService.t(
              "tooManyCharactersAlt",
              this.i18nService.t("button").toLocaleLowerCase(),
              20,
            ),
            20,
          ),
        ],
      ],
      showAfterEveryLogin: [null as boolean | null],
    });

  protected override buildRequestData() {
    if (!this.enabled.value) {
      return null;
    }
    const { header, description, buttonText, showAfterEveryLogin } = this.data.value;
    return {
      header: header?.trim() || null,
      description: description?.trim() || null,
      buttonText: buttonText?.trim() || null,
      showAfterEveryLogin,
    };
  }

  constructor() {
    super();
    const { header, description, buttonText, showAfterEveryLogin } = this.data.controls;
    const dependents = [header, description, showAfterEveryLogin];

    if (!this.singleOrgEnabled()) {
      this.enabled.disable();
      dependents.forEach((c) => c.disable());
      buttonText.disable();
    } else {
      this.enabled.enable();
      if (this.enabled.value) {
        dependents.forEach((c) => c.enable());
      }
    }

    this.enabled.valueChanges
      .pipe(startWith(this.enabled.value), takeUntilDestroyed())
      .subscribe((enabled) => {
        if (enabled) {
          dependents.forEach((c) => c.enable());
        } else {
          dependents.forEach((c) => c.disable());
          buttonText.disable();
        }
      });

    header.valueChanges
      .pipe(startWith(header.value), takeUntilDestroyed())
      .subscribe((headerValue) => {
        if (this.enabled.value && headerValue?.trim()) {
          buttonText.enable();
        } else {
          buttonText.disable();
        }
      });
  }
}
