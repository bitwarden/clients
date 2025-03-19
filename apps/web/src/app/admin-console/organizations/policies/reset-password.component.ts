import { Component, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class ResetPasswordPolicy extends BasePolicy {
  name = "accountRecoveryPolicy";
  description = "accountRecoveryPolicyDesc";
  type = PolicyType.ResetPassword;
  component = ResetPasswordPolicyComponent;

  display(organization: Organization) {
    return organization.useResetPassword;
  }
}

@Component({
  selector: "policy-reset-password",
  templateUrl: "reset-password.component.html",
})
export class ResetPasswordPolicyComponent extends BasePolicyComponent implements OnInit {
  data = this.formBuilder.group({
    autoEnrollEnabled: false,
  });
  showKeyConnectorInfo = false;

  constructor(
    private formBuilder: FormBuilder,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {
    super();
  }

  async ngOnInit() {
    super.ngOnInit();

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (!userId) {
      throw new Error("No user found.");
    }

    const organization = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.policyResponse.organizationId)),
    );

    if (!organization) {
      throw new Error("No organization found.");
    }
    this.showKeyConnectorInfo = organization.keyConnectorEnabled;
  }
}
