import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicyEditDefinition,
  BasePolicyEditComponent,
  PolicyCategory,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { SimpleTogglePolicyComponent } from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-edit-definitions/simple-toggle-policy.component";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

export class BlockClaimedDomainAccountCreationPolicy extends BasePolicyEditDefinition {
  name = "blockClaimedDomainAccountCreation";
  description = "blockClaimedDomainAccountCreationDesc";
  type = PolicyType.BlockClaimedDomainAccountCreation;
  category = PolicyCategory.Authentication;
  priority = 60;
  component = BlockClaimedDomainAccountCreationPolicyComponent;
  v2 = {
    component: SimpleTogglePolicyComponent,
    name: "blockClaimedDomainAccountCreation",
    description: "blockClaimedDomainAccountCreationDescV2",
    prerequisiteKey: "blockClaimedDomainAccountCreationPrerequisiteV2",
    prerequisiteLinkHref: "https://bitwarden.com/help/claimed-domains/",
    prerequisiteLinkTextKey: "blockClaimedDomainAccountCreationLearnMoreV2",
  };
}

@Component({
  selector: "block-claimed-domain-account-creation-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "block-claimed-domain-account-creation.component.html",
  imports: [SharedModule],
})
export class BlockClaimedDomainAccountCreationPolicyComponent extends BasePolicyEditComponent {}
