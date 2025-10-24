import { Component, OnInit, Signal, TemplateRef, viewChild } from "@angular/core";
import { BehaviorSubject, map, Observable } from "rxjs";

import { AutoConfirmSvg } from "@bitwarden/assets/svg";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { AutoConfirmPolicyDialogComponent } from "../auto-confirm-edit-policy-dialog.component";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class AutoConfirmPolicy extends BasePolicyEditDefinition {
  name = "autoConfirm";
  description = "autoConfirmDescription";
  type = PolicyType.AutoConfirm;
  component = AutoConfirmPolicyEditComponent;
  showDescription = false;
  editDialogComponent = AutoConfirmPolicyDialogComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService
      .getFeatureFlag$(FeatureFlag.AutoConfirm)
      .pipe(map((enabled) => enabled && organization.useAutomaticUserConfirmation));
  }
}

@Component({
  templateUrl: "auto-confirm-policy.component.html",
  imports: [SharedModule],
})
export class AutoConfirmPolicyEditComponent extends BasePolicyEditComponent implements OnInit {
  protected readonly autoConfirmSvg = AutoConfirmSvg;
  private policyForm: Signal<TemplateRef<any> | undefined> = viewChild("step0");
  private extensionButton: Signal<TemplateRef<any> | undefined> = viewChild("step1");

  protected step: number = 0;
  protected steps = [this.policyForm, this.extensionButton];

  protected singleOrgEnabled$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  setSingleOrgEnabled(enabled: boolean) {
    this.singleOrgEnabled$.next(enabled);
  }

  setStep(step: number) {
    this.step = step;
  }
}
