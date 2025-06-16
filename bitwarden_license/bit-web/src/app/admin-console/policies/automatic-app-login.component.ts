// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { FormBuilder, FormControl } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicy,
  BasePolicyComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/base-policy.component";

export class AutomaticAppLoginPolicy extends BasePolicy {
  name = "automaticAppLogin";
  description = "automaticAppLoginDesc";
  type = PolicyType.AutomaticAppLogIn;
  component = AutomaticAppLoginPolicyComponent;
}

@Component({
  selector: "policy-automatic-app-login",
  templateUrl: "automatic-app-login.component.html",
  standalone: false,
})
export class AutomaticAppLoginPolicyComponent extends BasePolicyComponent {
  data = this.formBuilder.group({
    idpHost: new FormControl<string>(null),
  });

  constructor(private formBuilder: FormBuilder) {
    super();
  }
}
