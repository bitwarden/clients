import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class OrganizationDataOwnershipPolicy extends BasePolicy {
  name = "organizationDataOwnership";
  description = "personalOwnershipPolicyDesc";
  type = PolicyType.OrganizationDataOwnership;
  component = OrganizationDataOwnershipPolicyComponent;
}

@Component({
  selector: "policy-organization-data-ownership",
  templateUrl: "organization-data-ownership.component.html",
  standalone: false,
})
export class OrganizationDataOwnershipPolicyComponent extends BasePolicyComponent {}
