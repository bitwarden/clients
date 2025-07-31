import { Component } from "@angular/core";
import { of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class RequireSsoPolicy extends BasePolicy {
  name = "requireSso";
  description = "requireSsoPolicyDesc";
  type = PolicyType.RequireSso;
  component = RequireSsoPolicyComponent;

  display(organization: Organization, configService: ConfigService) {
    return of(organization.useSso);
  }
}

@Component({
  selector: "policy-require-sso",
  templateUrl: "require-sso.component.html",
  standalone: false,
})
export class RequireSsoPolicyComponent extends BasePolicyComponent {}
