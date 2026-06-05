import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions/simple-toggle-policy.component";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class BlockClaimedDomainAccountCreationPolicy extends BasePolicyEditDefinition {
  name = "blockClaimedDomainAccountCreation";
  nameV2 = "blockClaimedDomainAccountCreationTitleV2";
  description = "blockClaimedDomainAccountCreationDesc";
  descriptionV2 = "blockClaimedDomainAccountCreationDescV2";
  type = PolicyType.BlockClaimedDomainAccountCreation;
  category = PolicyCategory.Authentication;
  priority = 60;
  component = BlockClaimedDomainAccountCreationPolicyComponent;
  prerequisiteKey = "blockClaimedDomainAccountCreationPrerequisiteV2";
  prerequisiteLinkHref = "https://bitwarden.com/help/domain-verification/";
  prerequisiteLinkTextKey = "blockClaimedDomainAccountCreationLearnMoreV2";
  flaggedComponent = {
    flag: FeatureFlag.PolicyDrawers,
    component: SimpleTogglePolicyComponent,
  };
}

@Component({
  selector: "block-claimed-domain-account-creation-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "block-claimed-domain-account-creation.component.html",
  imports: [SharedModule],
})
export class BlockClaimedDomainAccountCreationPolicyComponent extends BasePolicyEditComponent {}
