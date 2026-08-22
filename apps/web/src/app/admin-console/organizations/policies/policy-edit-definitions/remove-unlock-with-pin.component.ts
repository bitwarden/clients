import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class RemoveUnlockWithPinPolicy extends BasePolicyEditDefinition {
  name = "removeUnlockWithPinPolicyTitle";
  description = "removeUnlockWithPinPolicyDescV2";
  type = PolicyType.RemoveUnlockWithPin;
  category = PolicyCategory.Authentication;
  priority = 80;
  component = SimpleTogglePolicyComponent;
}
