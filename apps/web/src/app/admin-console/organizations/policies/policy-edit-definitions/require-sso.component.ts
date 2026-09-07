import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class RequireSsoPolicy extends BasePolicyEditDefinition {
  name = "requireSsoPolicyTitle";
  nameVfo1 = "requireSsoVfo1";
  description = "requireSsoPolicyDescV2";
  descriptionVfo1 = "requireSsoPolicyDescListVfo1";
  drawerDescriptionVfo1 = "requireSsoPolicyDescV2Vfo1";
  type = PolicyType.RequireSso;
  category = PolicyCategory.Authentication;
  priority = 30;
  component = SimpleTogglePolicyComponent;
  prerequisiteKey = "requireSsoPolicyReqV2";
  prerequisiteKeyVfo1 = "requireSsoPolicyReqV2Vfo1";

  display$(organization: Organization, configService: ConfigService) {
    return of(organization.useSso);
  }
}
