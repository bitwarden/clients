import { Component, OnInit } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { HelpUsersUpdatePasswordsPolicy } from "@bitwarden/web-vault/app/admin-console/organizations/policies";
import { AppComponent as BaseAppComponent } from "@bitwarden/web-vault/app/app.component";

import { ActivateAutofillPolicy } from "./admin-console/policies/activate-autofill.component";
import { AutomaticAppLoginPolicy } from "./admin-console/policies/automatic-app-login.component";
import { DisablePersonalVaultExportPolicy } from "./admin-console/policies/disable-personal-vault-export.component";
import { MaximumVaultTimeoutPolicy } from "./admin-console/policies/maximum-vault-timeout.component";
import { FreeFamiliesSponsorshipPolicy } from "./billing/policies/free-families-sponsorship.component";

@Component({
  selector: "app-root",
  templateUrl: "../../../../apps/web/src/app/app.component.html",
  standalone: false,
})
export class AppComponent extends BaseAppComponent implements OnInit {
  ngOnInit() {
    super.ngOnInit();

    this.policyListService.addPolicies([
      new MaximumVaultTimeoutPolicy(),
      new DisablePersonalVaultExportPolicy(),
      new FreeFamiliesSponsorshipPolicy(),
      new ActivateAutofillPolicy(),
    ]);

    void this.configService.getFeatureFlag(FeatureFlag.SecurityTasks).then((enabled) => {
      if (enabled) {
        this.policyListService.addPolicies([new HelpUsersUpdatePasswordsPolicy()]);
      }
    });

    if (!this.policyListService.getPolicies().some((p) => p instanceof AutomaticAppLoginPolicy)) {
      this.policyListService.addPolicies([new AutomaticAppLoginPolicy()]);
    }
  }
}
