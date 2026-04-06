// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Signal,
  TemplateRef,
  viewChild,
} from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";

import { AutoConfirmSvg } from "@bitwarden/assets/svg";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";
import { AutoConfirmPolicyDialogComponent } from "../policy-edit-dialogs/auto-confirm-edit-policy-dialog.component";

export class AutoConfirmPolicy extends BasePolicyEditDefinition {
  name = "automaticUserConfirmation";
  description = "autoConfirmDescription";
  type = PolicyType.AutoConfirm;
  category = PolicyCategory.VaultManagement;
  priority = 90;
  component = AutoConfirmPolicyEditComponent;
  showDescription = false;
  editDialogComponent = AutoConfirmPolicyDialogComponent;

  override display$(organization: Organization): Observable<boolean> {
    return of(organization.useAutomaticUserConfirmation);
  }
}

@Component({
  selector: "auto-confirm-policy-edit",
  templateUrl: "auto-confirm-policy.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoConfirmPolicyEditComponent extends BasePolicyEditComponent implements OnInit {
  protected readonly autoConfirmSvg = AutoConfirmSvg;
  private readonly policyForm: Signal<TemplateRef<any> | undefined> = viewChild("step0");
  private readonly extensionButton: Signal<TemplateRef<any> | undefined> = viewChild("step1");

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
