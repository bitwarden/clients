// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";
import { MultiStepPolicyEditDialogComponent } from "../policy-edit-dialogs";

import { MasterPasswordPolicyV2Component } from "./master-password-v2.component";

export class MasterPasswordPolicy extends BasePolicyEditDefinition {
  name = "masterPassPolicyTitle";
  description = "masterPassPolicyDesc";
  type = PolicyType.MasterPassword;
  category = PolicyCategory.Authentication;
  priority = 10;
  component = MasterPasswordPolicyComponent;
  editDialogComponent = MultiStepPolicyEditDialogComponent;
  v2 = {
    component: MasterPasswordPolicyV2Component,
    // MasterPasswordPolicyV2Component renders its own description inline; MasterPasswordPolicyComponent
    // (v1) does not, so the dialog's own showDescription (defaults to true) must stay on for v1.
    showDescription: false,
  };
}

@Component({
  selector: "master-password-policy-edit",
  templateUrl: "master-password.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MasterPasswordPolicyComponent extends BasePolicyEditComponent implements OnInit {
  MinPasswordLength = Utils.minimumPasswordLength;
  MaxPasswordLength = Utils.maximumPasswordLength;

  data: FormGroup<ControlsOf<MasterPasswordPolicyOptions>> = this.formBuilder.group({
    minComplexity: [null],
    minLength: [
      this.MinPasswordLength,
      [Validators.min(Utils.minimumPasswordLength), Validators.max(this.MaxPasswordLength)],
    ],
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
    const organization = await firstValueFrom(this.organization$);
    this.showKeyConnectorInfo = organization?.keyConnectorEnabled ?? false;
  }
}
