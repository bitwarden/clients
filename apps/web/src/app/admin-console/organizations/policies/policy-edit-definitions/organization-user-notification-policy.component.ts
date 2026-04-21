import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { map, startWith, switchMap } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

// Policy Definition Class
export class OrganizationUserNotificationPolicy extends BasePolicyEditDefinition {
  name = "organizationUserNotificationPolicyTitle"; // i18n key for title
  description = "organizationUserNotificationPolicyDesc"; // i18n key for description
  type = PolicyType.OrganizationUserNotification; // Reference to enum
  component = OrganizationUserNotificationPolicyComponent; // Reference to component
  category = PolicyCategory.VaultManagement;
  priority = -1;

  display$(organization: Organization, configService: ConfigService) {
    return configService.getFeatureFlag$(FeatureFlag.PM31948_OrgUserNotificationBanner);
  }
}

interface OrganizationUserNotificationPolicyOptions {
  allowBanner: boolean;
  header: string;
  description: string;
  buttonText: string;
  showAfterEveryLogin: boolean;
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

  private readonly singleOrgEnabled$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policies$(userId)),
    map((policies) => policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false),
  );

  protected readonly singleOrgEnabled = toSignal(this.singleOrgEnabled$, { initialValue: false });

  // Component implementation
  readonly data: FormGroup<ControlsOf<OrganizationUserNotificationPolicyOptions>> =
    this.formBuilder.group({
      allowBanner: [null as boolean],
      header: [null as string, Validators.maxLength(40)],
      description: [null as string, [Validators.required, Validators.maxLength(250)]],
      buttonText: [null as string, [Validators.maxLength(20)]],
      showAfterEveryLogin: [null as boolean],
    });

  constructor() {
    super();
    const { allowBanner, header, description, buttonText, showAfterEveryLogin } =
      this.data.controls;
    const dependents = [header, description, buttonText, showAfterEveryLogin];

    if (!this.singleOrgEnabled()) {
      allowBanner.disable();
      dependents.forEach((c) => c.disable());
    } else {
      allowBanner.enable();
      if (allowBanner.value) {
        dependents.forEach((c) => c.enable());
      }
    }

    allowBanner.valueChanges
      .pipe(startWith(allowBanner.value), takeUntilDestroyed())
      .subscribe((enabled) => {
        if (enabled) {
          dependents.forEach((c) => c.enable());
        } else {
          dependents.forEach((c) => c.disable());
        }
      });
  }
}
