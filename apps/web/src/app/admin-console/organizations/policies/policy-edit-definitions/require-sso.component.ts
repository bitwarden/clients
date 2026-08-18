import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class RequireSsoPolicy extends BasePolicyEditDefinition {
  name = "requireSsoPolicyTitle";
  description = "requireSsoPolicyDescV2";
  type = PolicyType.RequireSso;
  category = PolicyCategory.Authentication;
  priority = 30;
  component = SimpleTogglePolicyComponent;
  prerequisiteKey = "requireSsoPolicyReqV2";

  display$(organization: Organization, configService: ConfigService) {
    return of(organization.useSso);
  }
}
