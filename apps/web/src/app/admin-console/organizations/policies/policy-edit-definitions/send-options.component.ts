import { ChangeDetectionStrategy, Component } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class SendOptionsPolicy extends BasePolicyEditDefinition {
  name = "sendOptions";
  description = "sendOptionsPolicyDesc";
  type = PolicyType.SendOptions;
  category = PolicyCategory.DataControl;
  priority = 30;
  component = SendOptionsPolicyComponent;
}

@Component({
  selector: "send-options-policy-edit",
  templateUrl: "send-options.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendOptionsPolicyComponent extends BasePolicyEditComponent {
  readonly data = this.formBuilder.group({
    disableHideEmail: false,
  });

  constructor(private readonly formBuilder: UntypedFormBuilder) {
    super();
  }
}
