import { ChangeDetectionStrategy, Component } from "@angular/core";
import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

export class RequireSsoPolicy extends BasePolicyEditDefinition {
  name = "requireSso";
  description = "requireSsoPolicyDesc";
  type = PolicyType.RequireSso;
  category = PolicyCategory.Authentication;
  priority = 30;
  component = RequireSsoPolicyComponent;
  v2 = {
    flag: FeatureFlag.PolicyDrawers,
    component: SimpleTogglePolicyComponent,
    description: "requireSsoPolicyDescV2",
    prerequisiteKey: "requireSsoPolicyReqV2",
  };

  display$(organization: Organization, configService: ConfigService) {
    return of(organization.useSso);
  }
}

@Component({
  selector: "require-sso-policy-edit",
  templateUrl: "require-sso.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequireSsoPolicyComponent extends BasePolicyEditComponent {}
