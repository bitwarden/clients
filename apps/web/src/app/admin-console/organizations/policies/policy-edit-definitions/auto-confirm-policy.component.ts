import { Component, OnInit, Signal, TemplateRef, viewChild } from "@angular/core";
import { FormControl, UntypedFormBuilder, Validators } from "@angular/forms";
import { BehaviorSubject, map, Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class AutoConfirmPolicy extends BasePolicyEditDefinition {
  name = "autoConfirm";
  description = "autoConfirmDescription";
  type = PolicyType.AutoConfirm;
  component = AutoConfirmPolicyEditComponent;
  showDescription = false;
  // @TODO: assign the new AutoConfirmEditPolicyComponent here

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.AutoConfirm).pipe(
      // @FIXME: this should use the organization plan feature check "userAutoConfirm" which is still in progress
      map((a) => a && true),
    );
  }
}

@Component({
  templateUrl: "auto-confirm-policy.component.html",
  imports: [SharedModule],
})
export class AutoConfirmPolicyEditComponent extends BasePolicyEditComponent implements OnInit {
  private policyForm: Signal<TemplateRef<any> | undefined> = viewChild("step0");
  private extensionButton: Signal<TemplateRef<any> | undefined> = viewChild("step1");

  protected step: number = 0;
  protected steps = [this.policyForm, this.extensionButton];

  protected singleOrgEnabled$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  data = this.formBuilder.group({
    securityRisks: new FormControl(false, Validators.requiredTrue),
    singleOrgAccepted: new FormControl(false, Validators.requiredTrue),
    removeEmergencyAccess: new FormControl(false, Validators.requiredTrue),
  });

  constructor(private formBuilder: UntypedFormBuilder) {
    super();
  }

  setSingleOrgEnabled(enabled: boolean) {
    this.singleOrgEnabled$.next(enabled);
  }

  setStep(step: number) {
    this.step = step;
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.data.updateValueAndValidity();
  }
}
