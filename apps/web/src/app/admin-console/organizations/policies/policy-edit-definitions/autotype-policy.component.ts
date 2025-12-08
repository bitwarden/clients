import { ChangeDetectionStrategy, Component } from "@angular/core";
import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class DesktopAutotypeDefaultSettingPolicy extends BasePolicyEditDefinition {
  name = "desktopAutotypePolicy";
  description = "desktopAutotypePolicyDesc";
  type = PolicyType.AutotypeDefaultSetting;
  component = DesktopAutotypeDefaultSettingPolicyComponent;

  display$(organization: Organization) {
    return of(true);
  }
}
@Component({
  selector: "autotype-policy-edit",
  templateUrl: "autotype-policy.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopAutotypeDefaultSettingPolicyComponent extends BasePolicyEditComponent {}
