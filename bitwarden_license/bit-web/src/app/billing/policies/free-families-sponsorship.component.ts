import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  BasePolicy,
  BasePolicyComponent,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/base-policy.component";

export class FreeFamiliesSponsorshipPolicy extends BasePolicy {
  name = "freeFamiliesSponsorship";
  description = "freeFamiliesSponsorshipPolicyDesc";
  type = PolicyType.FreeFamiliesSponsorshipPolicy;
  component = FreeFamiliesSponsorshipPolicyComponent;
}

@Component({
  selector: "policy-personal-ownership",
  templateUrl: "free-families-sponsorship.component.html",
})
export class FreeFamiliesSponsorshipPolicyComponent extends BasePolicyComponent {}
