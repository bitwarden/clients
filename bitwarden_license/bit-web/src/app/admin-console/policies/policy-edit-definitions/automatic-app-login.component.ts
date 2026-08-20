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

export class AutomaticAppLoginPolicy extends BasePolicyEditDefinition {
  name = "automaticAppLoginWithSSO";
  description = "automaticAppLoginWithSSODescV2";
  type = PolicyType.AutomaticAppLogIn;
  category = PolicyCategory.VaultManagement;
  priority = 30;
  component = AutomaticAppLoginPolicyComponent;
}

@Component({
  selector: "automatic-app-login-policy-edit",
  templateUrl: "automatic-app-login.component.html",
  imports: [FormControlModule, FormFieldModule, ReactiveFormsModule, SwitchComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutomaticAppLoginPolicyComponent extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly data = this.formBuilder.group({
    idpHost: new FormControl<string>(null),
  });
}
