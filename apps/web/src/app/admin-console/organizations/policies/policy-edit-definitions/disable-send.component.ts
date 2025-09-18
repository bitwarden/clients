import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class DisableSendPolicy extends BasePolicyEditDefinition {
  name = "disableSend";
  description = "disableSendPolicyDesc";
  type = PolicyType.DisableSend;
  component = DisableSendPolicyComponent;
}

@Component({
  templateUrl: "disable-send.component.html",
  imports: [SharedModule],
})
export class DisableSendPolicyComponent extends BasePolicyEditComponent {}
