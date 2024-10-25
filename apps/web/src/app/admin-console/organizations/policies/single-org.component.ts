import { Component, OnInit } from "@angular/core";
import { firstValueFrom, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

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
  constructor(
    private i18nService: I18nService,
    private configService: ConfigService,
  ) {
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

  async buildRequest(policiesEnabledMap: Map<PolicyType, boolean>): Promise<PolicyRequest> {
    if (await this.configService.getFeatureFlag(FeatureFlag.Pm13322AddPolicyDefinitions)) {
      // We are now relying on server-side validation only
      return super.buildRequest(policiesEnabledMap);
    }

    if (!this.enabled.value) {
      if (policiesEnabledMap.get(PolicyType.RequireSso) ?? false) {
        throw new Error(
          this.i18nService.t("disableRequiredError", this.i18nService.t("requireSso")),
        );
      }

      if (policiesEnabledMap.get(PolicyType.MaximumVaultTimeout) ?? false) {
        throw new Error(
          this.i18nService.t(
            "disableRequiredError",
            this.i18nService.t("maximumVaultTimeoutLabel"),
          ),
        );
      }

      if (
        (await firstValueFrom(this.accountDeprovisioningEnabled$)) &&
        !this.policyResponse.canToggleState
      ) {
        throw new Error(
          this.i18nService.t("disableRequiredError", this.i18nService.t("singleOrg")),
        );
      }
    }

    return super.buildRequest(policiesEnabledMap);
  }
}
