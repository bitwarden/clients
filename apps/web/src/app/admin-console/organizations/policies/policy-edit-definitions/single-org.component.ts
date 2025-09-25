import { Component, OnInit } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class SingleOrgPolicy extends BasePolicyEditDefinition {
  name = "singleOrg";
  description = "singleOrgPolicyDesc";
  type = PolicyType.SingleOrg;
  component = SingleOrgPolicyComponent;
}

@Component({
  templateUrl: "single-org.component.html",
  imports: [SharedModule],
})
export class SingleOrgPolicyComponent extends BasePolicyEditComponent implements OnInit {
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
