import { Component, OnInit } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class SingleOrgPolicy extends BasePolicy {
  name = "singleOrg";
  description = "singleOrgPolicyDesc";
  type = PolicyType.SingleOrg;
  component = SingleOrgPolicyComponent;
}

@Component({
  selector: "policy-single-org",
  templateUrl: "single-org.component.html",
  standalone: false,
})
export class SingleOrgPolicyComponent extends BasePolicyComponent implements OnInit {
  async ngOnInit() {
    super.ngOnInit();

    if (!this.policyResponse.canToggleState) {
      this.enabled.disable();
    }
  }
}
