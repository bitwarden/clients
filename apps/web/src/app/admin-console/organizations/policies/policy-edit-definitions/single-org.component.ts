import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class SingleOrgPolicy extends BasePolicyEditDefinition {
  name = "singleOrg";
  description = "singleOrgPolicyDesc";
  type = PolicyType.SingleOrg;
  category = PolicyCategory.DataControl;
  priority = 10;
  component = SingleOrgPolicyComponent;
}

@Component({
  selector: "single-org-policy-edit",
  templateUrl: "single-org.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SingleOrgPolicyComponent extends BasePolicyEditComponent implements OnInit {
  async ngOnInit() {
    super.ngOnInit();

    if (!this.policyResponse()) {
      throw new Error("Policies not found");
    }
    if (!this.policyResponse()!.canToggleState) {
      this.enabled.disable();
    }
  }
}
