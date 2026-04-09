import { ChangeDetectionStrategy, Component, Signal, TemplateRef, viewChild } from "@angular/core";
import { Router } from "@angular/router";
import { combineLatest, defer, firstValueFrom, map, Observable, startWith, switchMap } from "rxjs";

import { AutoConfirmSvg } from "@bitwarden/assets/svg";
import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";
import {
  MultiStepPolicyEditDialogComponent,
  PolicyStep,
  PolicyStepResult,
} from "../policy-edit-dialogs";

export class AutoConfirmPolicy extends BasePolicyEditDefinition {
  name = "automaticUserConfirmation";
  description = "autoConfirmDescription";
  type = PolicyType.AutoConfirm;
  category = PolicyCategory.VaultManagement;
  priority = 90;
  component = AutoConfirmPolicyEditComponent;
  showDescription = false;
  editDialogComponent = MultiStepPolicyEditDialogComponent;

  constructor(readonly firstTimeDialog: boolean = false) {
    super();
  }

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
export class AutoConfirmPolicyEditComponent extends BasePolicyEditComponent {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly policyService: PolicyService,
    private readonly autoConfirmService: AutomaticUserConfirmationService,
    private readonly router: Router,
  ) {
    super();
  }

  protected readonly autoConfirmSvg = AutoConfirmSvg;

  protected get autoConfirmPolicy(): AutoConfirmPolicy | undefined {
    return this.policy() as AutoConfirmPolicy | undefined;
  }

  private readonly step0Title: Signal<TemplateRef<unknown>> = viewChild.required("step0Title");
  private readonly step0Content: Signal<TemplateRef<unknown>> = viewChild.required("step0Content");
  private readonly step0Footer: Signal<TemplateRef<unknown>> = viewChild.required("step0Footer");

  private readonly step1Title: Signal<TemplateRef<unknown>> = viewChild.required("step1Title");
  private readonly step1Content: Signal<TemplateRef<unknown>> = viewChild.required("step1Content");
  private readonly step1Footer: Signal<TemplateRef<unknown>> = viewChild.required("step1Footer");

  protected readonly autoConfirmEnabled$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policies$(userId)),
      map((policies) => policies.find((p) => p.type === PolicyType.AutoConfirm)?.enabled ?? false),
    );

  protected readonly singleOrgEnabled$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policies$(userId)),
      map((policies) => policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false),
    );

  // defer() ensures this.organizationId() is read at subscription time rather than at
  // class-field initialization time, where it would still be undefined.
  protected readonly managePoliciesOnly$: Observable<boolean> = defer(() =>
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(this.organizationId()),
      map((organization) => (!organization?.isAdmin && organization?.canManagePolicies) ?? false),
    ),
  );

  protected readonly saveDisabled$ = combineLatest([
    this.autoConfirmEnabled$,
    this.enabled.valueChanges.pipe(startWith(this.enabled.value)),
  ]).pipe(map(([policyEnabled, value]) => !policyEnabled && !value));

  readonly policySteps: PolicyStep[] = [
    {
      titleContent: this.step0Title,
      bodyContent: this.step0Content,
      footerContent: this.step0Footer,
      disableSave: this.saveDisabled$,
      sideEffect: () => this.savePolicy(),
    },
    {
      titleContent: this.step1Title,
      bodyContent: this.step1Content,
      footerContent: this.step1Footer,
      sideEffect: () => this.navigateToExtensionPromptStep(),
    },
  ];

  protected override async savePolicy(): Promise<PolicyStepResult | void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const organizations = await firstValueFrom(this.organizationService.organizations$(userId));
    const organization = organizations.find((o) => o.id === this.organizationId()) ?? null;
    const managePoliciesOnly = (!organization?.isAdmin && organization?.canManagePolicies) ?? false;

    const policies = await firstValueFrom(this.policyService.policies$(userId));
    const singleOrgAlreadyEnabled =
      policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false;
    const enabledSingleOrgDuringAction = !singleOrgAlreadyEnabled;

    // AutoConfirm requires SingleOrg; enable it as a prerequisite if not already on.
    if (enabledSingleOrgDuringAction) {
      await this.policyApiService.putPolicyVNext(
        this.organizationId() ?? "",
        PolicyType.SingleOrg,
        {
          policy: { enabled: true, data: null },
          metadata: null,
        },
      );
    }

    try {
      const request = await this.buildRequest();
      await this.policyApiService.putPolicyVNext(
        this.organizationId() ?? "",
        PolicyType.AutoConfirm,
        { policy: request, metadata: null },
      );
    } catch (error) {
      // Roll back the SingleOrg enablement if AutoConfirm save fails.
      if (enabledSingleOrgDuringAction) {
        await this.policyApiService.putPolicyVNext(
          this.organizationId() ?? "",
          PolicyType.SingleOrg,
          { policy: { enabled: false, data: null }, metadata: null },
        );
      }
      throw error;
    }

    // Dismiss the first-time setup dialog prompt now that the admin has configured the policy.
    const currentState = await firstValueFrom(this.autoConfirmService.configuration$(userId));
    await this.autoConfirmService.upsert(userId, { ...currentState, showSetupDialog: false });

    // Close immediately when disabling (no extension step needed) or when the user only has
    // manage-policies permission and cannot configure the client-side extension setting.
    if (!this.enabled.value || managePoliciesOnly) {
      return { closeDialog: true };
    }
  }

  private async navigateToExtensionPromptStep(): Promise<void> {
    await this.router.navigate(["/browser-extension-prompt"], {
      queryParams: { url: "AutoConfirm" },
    });
  }
}
