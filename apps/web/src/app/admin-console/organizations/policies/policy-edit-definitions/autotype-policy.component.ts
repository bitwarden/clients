import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { autotypeFeatureFlagEnabled$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class DesktopAutotypeDefaultSettingPolicy extends BasePolicyEditDefinition {
  name = "desktopAutotypePolicyTitleV2";
  description = "desktopAutotypePolicyDescV2";
  type = PolicyType.AutotypeDefaultSetting;
  category = PolicyCategory.VaultManagement;
  priority = 70;
  component = SimpleTogglePolicyComponent;

  display$(organization: Organization, configService: ConfigService) {
    return autotypeFeatureFlagEnabled$(configService);
  }
}
