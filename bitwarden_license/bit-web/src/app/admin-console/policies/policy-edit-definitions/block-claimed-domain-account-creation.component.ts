import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicyEditDefinition,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions/simple-toggle-policy.component";

export class BlockClaimedDomainAccountCreationPolicy extends BasePolicyEditDefinition {
  name = "blockClaimedDomainAccountCreation";
  description = "blockClaimedDomainAccountCreationDescV2";
  descriptionVfo1 = "blockClaimedDomainAccountCreationDescVfo1";
  drawerDescriptionVfo1 = "blockClaimedDomainAccountCreationDescV2Vfo1";
  type = PolicyType.BlockClaimedDomainAccountCreation;
  category = PolicyCategory.Authentication;
  priority = 60;
  component = SimpleTogglePolicyComponent;
  prerequisiteKey = "blockClaimedDomainAccountCreationPrerequisiteV2";
  prerequisiteLinkHref = "https://bitwarden.com/help/claimed-domains/";
  prerequisiteLinkTextKey = "blockClaimedDomainAccountCreationLearnMoreV2";
}
