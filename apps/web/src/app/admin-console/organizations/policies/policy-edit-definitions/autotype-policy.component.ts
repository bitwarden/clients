import { ChangeDetectionStrategy, Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class DesktopAutotypeDefaultSettingPolicy extends BasePolicyEditDefinition {
  name = "desktopAutotypePolicy";
  description = "desktopAutotypePolicyDesc";
  type = PolicyType.AutotypeDefaultSetting;
  category = PolicyCategory.VaultManagement;
  priority = 70;
  component = DesktopAutotypeDefaultSettingPolicyComponent;

  display$(organization: Organization, configService: ConfigService) {
    return configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype);
  }
}
@Component({
  selector: "autotype-policy-edit",
  templateUrl: "autotype-policy.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopAutotypeDefaultSettingPolicyComponent extends BasePolicyEditComponent {}
