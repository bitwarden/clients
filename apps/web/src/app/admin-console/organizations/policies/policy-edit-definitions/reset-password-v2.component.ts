import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CalloutComponent,
  CheckboxModule,
  FormControlModule,
  LinkComponent,
  SwitchComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class ResetPasswordPolicyV2 extends BasePolicyEditDefinition {
  name = "accountRecoveryPolicy";
  description = "accountRecoveryPolicyDescV2";
  type = PolicyType.ResetPassword;
  category = PolicyCategory.Authentication;
  priority = 20;
  component = ResetPasswordPolicyV2Component;
  showDescription = false;
  showEnabledBadge = true;

  display$(organization: Organization, configService: ConfigService) {
    return configService
      .getFeatureFlag$(FeatureFlag.PolicyDrawers)
      .pipe(map((drawerEnabled) => drawerEnabled && organization.useResetPassword));
  }
}

@Component({
  selector: "reset-password-policy-v2-edit",
  templateUrl: "reset-password-v2.component.html",
  imports: [
    AsyncPipe,
    CalloutComponent,
    CheckboxModule,
    FormControlModule,
    LinkComponent,
    ReactiveFormsModule,
    SwitchComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPolicyV2Component extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly data = this.formBuilder.group({
    autoEnrollEnabled: [{ value: false, disabled: true }],
  });

  readonly showKeyConnectorInfo$ = this.organization$.pipe(
    map((org) => org?.keyConnectorEnabled ?? false),
  );

  constructor() {
    super();

    this.enabled.valueChanges.pipe(takeUntilDestroyed()).subscribe((enabled) => {
      if (enabled) {
        this.data.controls.autoEnrollEnabled.enable();
      } else {
        this.data.controls.autoEnrollEnabled.disable();
        this.data.controls.autoEnrollEnabled.setValue(false);
      }
    });
  }
}
