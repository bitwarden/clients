import { Component } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class SendOptionsPolicy extends BasePolicyEditDefinition {
  name = "sendOptions";
  description = "sendOptionsPolicyDesc";
  type = PolicyType.SendOptions;
  component = SendOptionsPolicyComponent;
}

@Component({
  templateUrl: "send-options.component.html",
  imports: [SharedModule],
})
export class SendOptionsPolicyComponent extends BasePolicyEditComponent {
  data = this.formBuilder.group({
    disableHideEmail: false,
  });

  constructor(private formBuilder: UntypedFormBuilder) {
    super();
  }
}
