import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class TwoFactorAuthenticationPolicy extends BasePolicyEditDefinition {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  component = TwoFactorAuthenticationPolicyComponent;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "two-factor-authentication.component.html",
  imports: [SharedModule],
})
export class TwoFactorAuthenticationPolicyComponent extends BasePolicyEditComponent {}
