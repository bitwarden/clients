import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Signal,
  TemplateRef,
  viewChild,
} from "@angular/core";
import { BehaviorSubject, combineLatest, map, Observable, startWith, switchMap } from "rxjs";

import { AutoConfirmSvg } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { MultiStepPolicyEditDialogComponent, PolicyStep } from "../policy-edit-dialogs";

export class AutoConfirmPolicy extends BasePolicyEditDefinition {
  name = "automaticUserConfirmation";
  description = "autoConfirmDescription";
  type = PolicyType.AutoConfirm;
  component = AutoConfirmPolicyEditComponent;
  showDescription = false;
  editDialogComponent = MultiStepPolicyEditDialogComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService
      .getFeatureFlag$(FeatureFlag.AutoConfirm)
      .pipe(map((enabled) => enabled && organization.useAutomaticUserConfirmation));
  }
}

@Component({
  selector: "auto-confirm-policy-edit",
  templateUrl: "auto-confirm-policy.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoConfirmPolicyEditComponent extends BasePolicyEditComponent implements OnInit {
  constructor(
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private policyService: PolicyService,
  ) {
    super();
  }

  protected readonly autoConfirmSvg = AutoConfirmSvg;

  private readonly step0Title: Signal<TemplateRef<unknown>> = viewChild.required("step0Title");
  private readonly step0Content: Signal<TemplateRef<unknown>> = viewChild.required("step0Content");
  private readonly step0Footer: Signal<TemplateRef<unknown>> = viewChild.required("step0Footer");

  private readonly step1Title: Signal<TemplateRef<unknown>> = viewChild.required("step1Title");
  private readonly step1Content: Signal<TemplateRef<unknown>> = viewChild.required("step1Content");
  private readonly step1Footer: Signal<TemplateRef<unknown>> = viewChild.required("step1Footer");

  protected autoConfirmEnabled$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policies$(userId)),
    map((policies) => policies.find((p) => p.type === PolicyType.AutoConfirm)?.enabled ?? false),
  );

  // fix this later
  firstTimeDialog = false;

  protected managePoliciesOnly$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.organizationService.organizations$(userId)),
    getById(this.policyResponse?.organizationId),
    map((organization) => (!organization?.isAdmin && organization?.canManagePolicies) ?? false),
  );

  protected saveDisabled$ = combineLatest([
    this.autoConfirmEnabled$,
    this.enabled.valueChanges.pipe(startWith(this.enabled.value)),
  ]).pipe(map(([policyEnabled, value]) => !policyEnabled && !value));

  protected step: number = 0;

  policySteps: PolicyStep[] = [
    {
      titleContent: this.step0Title,
      bodyContent: this.step0Content,
      footerContent: this.step0Footer,
    },
    {
      titleContent: this.step1Title,
      bodyContent: this.step1Content,
      footerContent: this.step1Footer,
    },
  ];

  protected singleOrgEnabled$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  setSingleOrgEnabled(enabled: boolean) {
    this.singleOrgEnabled$.next(enabled);
  }

  setStep(step: number) {
    this.step = step;
  }
}
