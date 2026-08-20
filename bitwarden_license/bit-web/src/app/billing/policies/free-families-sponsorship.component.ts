import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicyEditDefinition,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions/simple-toggle-policy.component";

export class FreeFamiliesSponsorshipPolicy extends BasePolicyEditDefinition {
  name = "freeFamiliesSponsorshipPolicyTitleV2";
  description = "freeFamiliesSponsorshipPolicyDescV2";
  type = PolicyType.FreeFamiliesSponsorship;
  category = PolicyCategory.VaultManagement;
  priority = 60;
  component = SimpleTogglePolicyComponent;
}
