import { Component, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

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
  ) {
    super();
  }

  async ngOnInit() {
    super.ngOnInit();
    const organization = await this.organizationService.get(this.policyResponse.organizationId);
    this.showKeyConnectorInfo = organization.keyConnectorEnabled;
  }
}
