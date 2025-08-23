import { Component } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../shared";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class SendOptionsPolicy extends BasePolicy {
  name = "sendOptions";
  description = "sendOptionsPolicyDesc";
  type = PolicyType.SendOptions;
  component = SendOptionsPolicyComponent;
}

@Component({
  templateUrl: "send-options.component.html",
  imports: [SharedModule],
})
export class SendOptionsPolicyComponent extends BasePolicyComponent {
  data = this.formBuilder.group({
    disableHideEmail: false,
  });

  constructor(private formBuilder: UntypedFormBuilder) {
    super();
  }
}
