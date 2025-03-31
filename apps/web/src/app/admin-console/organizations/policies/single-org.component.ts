import { Component, OnInit } from "@angular/core";
import { firstValueFrom, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class SingleOrgPolicy extends BasePolicy {
  name = "singleOrg";
  description = "singleOrgDesc";
  type = PolicyType.SingleOrg;
  component = SingleOrgPolicyComponent;
}

@Component({
  selector: "policy-single-org",
  templateUrl: "single-org.component.html",
})
export class SingleOrgPolicyComponent extends BasePolicyComponent implements OnInit {
  constructor(private configService: ConfigService) {
    super();
  }

  protected accountDeprovisioningEnabled$: Observable<boolean> = this.configService.getFeatureFlag$(
    FeatureFlag.AccountDeprovisioning,
  );

  async ngOnInit() {
    super.ngOnInit();

    const isAccountDeprovisioningEnabled = await firstValueFrom(this.accountDeprovisioningEnabled$);
    this.policy.description = isAccountDeprovisioningEnabled
      ? "singleOrgPolicyDesc"
      : "singleOrgDesc";

    if (!this.policyResponse.canToggleState) {
      this.enabled.disable();
    }
  }
}
