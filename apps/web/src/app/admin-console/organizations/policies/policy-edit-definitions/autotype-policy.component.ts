import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class DesktopAutotypeDefaultSettingPolicy extends BasePolicyEditDefinition {
  name = "desktopAutotypePolicy";
  description = "desktopAutotypePolicyDesc";
  type = PolicyType.AutotypeDefaultSetting;
  component = AutotypeDefaultSettingPolicyComponent;

  display$(organization: Organization, configService: ConfigService) {
    return configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype);
  }
}
@Component({
  templateUrl: "autotype-policy.component.html",
  imports: [SharedModule],
})
export class AutotypeDefaultSettingPolicyComponent extends BasePolicyEditComponent {}
