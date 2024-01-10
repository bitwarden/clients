import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class MasterPasswordPolicy extends BasePolicy {
  name = "masterPassPolicyTitle";
  description = "masterPassPolicyDesc";
  type = PolicyType.MasterPassword;
  component = MasterPasswordPolicyComponent;
}

@Component({
  selector: "policy-master-password",
  templateUrl: "master-password.component.html",
})
export class MasterPasswordPolicyComponent extends BasePolicyComponent implements OnInit {
  MinPasswordLength = Utils.minimumPasswordLength;

  data: FormGroup<ControlsOf<MasterPasswordPolicyOptions>> = this.formBuilder.group({
    minComplexity: [null],
    minLength: [this.MinPasswordLength, [Validators.min(Utils.minimumPasswordLength)]],
    requireUpper: [false],
    requireLower: [false],
    requireNumbers: [false],
    requireSpecial: [false],
    enforceOnLogin: [false],
  });

  passwordScores: { name: string; value: number }[];
  showKeyConnectorInfo = false;

  constructor(
    private formBuilder: FormBuilder,
    i18nService: I18nService,
    private organizationService: OrganizationService,
  ) {
    super();

    this.passwordScores = [
      { name: "-- " + i18nService.t("select") + " --", value: null },
      { name: i18nService.t("weak") + " (0)", value: 0 },
      { name: i18nService.t("weak") + " (1)", value: 1 },
      { name: i18nService.t("weak") + " (2)", value: 2 },
      { name: i18nService.t("good") + " (3)", value: 3 },
      { name: i18nService.t("strong") + " (4)", value: 4 },
    ];
  }

  async ngOnInit() {
    super.ngOnInit();
    const organization = await this.organizationService.get(this.policyResponse.organizationId);
    this.showKeyConnectorInfo = organization.keyConnectorEnabled;
  }
}
