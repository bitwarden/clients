import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class TwoFactorAuthenticationPolicy extends BasePolicy {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  component = TwoFactorAuthenticationPolicyComponent;
}

@Component({
  selector: "policy-two-factor-authentication",
  templateUrl: "two-factor-authentication.component.html",
  standalone: false,
})
export class TwoFactorAuthenticationPolicyComponent extends BasePolicyComponent {}
