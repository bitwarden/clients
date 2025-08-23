import { Component, OnInit } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class SingleOrgPolicy extends BasePolicy {
  name = "singleOrg";
  description = "singleOrgPolicyDesc";
  type = PolicyType.SingleOrg;
  component = SingleOrgPolicyComponent;
}

@Component({
  templateUrl: "single-org.component.html",
  imports: [SharedModule],
})
export class SingleOrgPolicyComponent extends BasePolicyComponent implements OnInit {
  async ngOnInit() {
    super.ngOnInit();

    if (!this.policyResponse) {
      throw new Error("Policies not found");
    }
    if (!this.policyResponse.canToggleState) {
      this.enabled.disable();
    }
  }
}
