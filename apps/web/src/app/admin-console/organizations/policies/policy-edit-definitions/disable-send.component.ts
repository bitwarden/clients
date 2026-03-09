import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class DisableSendPolicy extends BasePolicyEditDefinition {
  name = "disableSend";
  description = "disableSendPolicyDesc";
  type = PolicyType.DisableSend;
  category = PolicyCategory.DataControl;
  priority = 40;
  component = DisableSendPolicyComponent;
}

@Component({
  selector: "disable-send-policy-edit",
  templateUrl: "disable-send.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisableSendPolicyComponent extends BasePolicyEditComponent {}
