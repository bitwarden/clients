// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom, map, tap } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class ResetPasswordPolicy extends BasePolicyEditDefinition {
  name = "accountRecoveryPolicy";
  description = "accountRecoveryPolicyDesc";
  type = PolicyType.ResetPassword;
  category = PolicyCategory.Authentication;
  priority = 20;
  component = ResetPasswordPolicyComponent;

  display$(organization: Organization, configService: ConfigService) {
    return configService.getFeatureFlag$(FeatureFlag.AdminResetTwoFactor).pipe(
      tap((enabled) => {
        this.description = enabled ? "accountRecoveryPolicyDescV2" : "accountRecoveryPolicyDesc";
      }),
      map(() => organization.useResetPassword),
    );
  }
}

@Component({
  selector: "reset-password-policy-edit",
  templateUrl: "reset-password.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPolicyComponent extends BasePolicyEditComponent implements OnInit {
  private configService = inject(ConfigService);

  data = this.formBuilder.group({
    autoEnrollEnabled: false,
  });
  showKeyConnectorInfo = false;
  protected readonly adminResetTwoFactorEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.AdminResetTwoFactor),
    { initialValue: false },
  );

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

    if (!this.policyResponse) {
      throw new Error("Policies not found");
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
