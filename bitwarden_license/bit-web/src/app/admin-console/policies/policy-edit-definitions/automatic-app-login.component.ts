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
  name = "automaticAppLoginWithSSO";
  description = "automaticAppLoginWithSSODesc";
  type = PolicyType.AutomaticAppLogIn;
  component = AutomaticAppLoginPolicyComponent;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
