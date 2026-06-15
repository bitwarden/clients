import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class TwoFactorAuthenticationPolicy extends BasePolicyEditDefinition {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  category = PolicyCategory.Authentication;
  priority = 40;
  component = TwoFactorAuthenticationPolicyComponent;
}

@Component({
  selector: "two-factor-authentication-policy-edit",
  templateUrl: "two-factor-authentication.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorAuthenticationPolicyComponent extends BasePolicyEditComponent {}
