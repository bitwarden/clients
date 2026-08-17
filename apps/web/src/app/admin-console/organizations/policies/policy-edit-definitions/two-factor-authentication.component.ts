import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class TwoFactorAuthenticationPolicy extends BasePolicyEditDefinition {
  name = "twoStepLoginPolicyTitle";
  description = "twoStepLoginPolicyDescV2";
  type = PolicyType.TwoFactorAuthentication;
  category = PolicyCategory.Authentication;
  priority = 40;
  component = SimpleTogglePolicyComponent;
  warningKey = "twoStepLoginPolicyWarningV2";
}
