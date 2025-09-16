// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { FormBuilder, FormControl } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class AutomaticAppLoginPolicy extends BasePolicyEditDefinition {
  name = "automaticAppLogin";
  description = "automaticAppLoginDesc";
  type = PolicyType.AutomaticAppLogIn;
  component = AutomaticAppLoginPolicyComponent;
}

@Component({
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
