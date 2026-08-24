import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class SingleOrgPolicy extends BasePolicyEditDefinition {
  name = "singleOrg";
  nameVfo1 = "singleOrgVfo1";
  description = "singleOrgPolicyDescV2";
  descriptionVfo1 = "singleOrgPolicyDescVfo1";
  drawerDescriptionVfo1 = "singleOrgPolicyDescV2Vfo1";
  type = PolicyType.SingleOrg;
  category = PolicyCategory.DataControl;
  priority = 10;
  component = SimpleTogglePolicyComponent;
  warningKey = "singleOrgPolicyMemberWarning";
}
