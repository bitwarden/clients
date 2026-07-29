// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { FormControlModule, FormFieldModule, SwitchComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class AutomaticAppLoginPolicy extends BasePolicyEditDefinition {
  name = "automaticAppLoginWithSSO";
  description = "automaticAppLoginWithSSODesc";
  type = PolicyType.AutomaticAppLogIn;
  category = PolicyCategory.VaultManagement;
  priority = 30;
  component = AutomaticAppLoginPolicyComponent;
  v2 = {
    component: AutomaticAppLoginPolicyV2Component,
    description: "automaticAppLoginWithSSODescV2",
  };
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "automatic-app-login-policy-edit",
  templateUrl: "automatic-app-login.component.html",
  imports: [SharedModule],
})
export class AutomaticAppLoginPolicyComponent extends BasePolicyEditComponent {
  data = this.formBuilder.group({
    idpHost: new FormControl<string>(null),
  });

  constructor(private formBuilder: FormBuilder) {
    super();
  }
}

/**
 * Drawer (v2) variant. Same `idpHost` form logic as v1, but the enable toggle is rendered as a
 * switch instead of a checkbox, per the new drawer UI pattern (see FeatureFlag.PolicyDrawers).
 */
@Component({
  selector: "automatic-app-login-v2-policy-edit",
  templateUrl: "automatic-app-login-v2.component.html",
  imports: [FormControlModule, FormFieldModule, ReactiveFormsModule, SwitchComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutomaticAppLoginPolicyV2Component extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly data = this.formBuilder.group({
    idpHost: new FormControl<string>(null),
  });
}
