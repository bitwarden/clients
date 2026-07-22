// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom, of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { ResetPasswordPolicyV2Component } from "./reset-password-v2.component";

export class ResetPasswordPolicy extends BasePolicyEditDefinition {
  name = "accountRecoveryPolicy";
  description = "accountRecoveryPolicyDescV2";
  type = PolicyType.ResetPassword;
  category = PolicyCategory.Authentication;
  priority = 20;
  component = ResetPasswordPolicyComponent;
  v2 = {
    component: ResetPasswordPolicyV2Component,
    showDescription: false,
  };

  display$(organization: Organization, _configService: ConfigService) {
    return of(organization.useResetPassword);
  }
}

@Component({
  selector: "reset-password-policy-edit",
  templateUrl: "reset-password.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPolicyComponent extends BasePolicyEditComponent implements OnInit {
  data = this.formBuilder.group({
    autoEnrollEnabled: [{ value: false, disabled: true }],
  });
  showKeyConnectorInfo = false;

  constructor(private formBuilder: FormBuilder) {
    super();

    this.enabled.valueChanges.pipe(takeUntilDestroyed()).subscribe((enabled) => {
      if (enabled) {
        this.data.controls.autoEnrollEnabled.enable();
      } else {
        this.data.controls.autoEnrollEnabled.disable();
        this.data.controls.autoEnrollEnabled.setValue(false);
      }
    });
  }

  async ngOnInit() {
    super.ngOnInit();

    const organization = await firstValueFrom(this.organization$);

    if (!organization) {
      throw new Error("No organization found.");
    }
    this.showKeyConnectorInfo = organization.keyConnectorEnabled;
  }
}
