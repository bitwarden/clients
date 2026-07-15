import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Signal,
  TemplateRef,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, Observable, of, startWith, switchMap } from "rxjs";

import { AutoConfirmSvg } from "@bitwarden/assets/svg";
import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SwitchComponent } from "@bitwarden/components";

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
  type = PolicyType.AutomaticUserConfirmation;
  category = PolicyCategory.VaultManagement;
  priority = 90;
  component = AutoConfirmPolicyEditComponent;
  showDescription = false;
  editDialogComponent = MultiStepPolicyEditDialogComponent;
  // Explicitly typed against the base class's declared `v2` shape (rather than left to be
  // inferred from this literal) so that optional fields like `description`/`prerequisiteKey`
  // remain valid to access - even though this policy doesn't set them - instead of TypeScript
  // narrowing the field to only `{ component: ... }`.
  v2: BasePolicyEditDefinition["v2"] = {
    component: AutoConfirmPolicyEditV2Component,
  };

  constructor(readonly firstTimeDialog: boolean = false) {
    super();
  }

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
export class AutoConfirmPolicyEditComponent extends BasePolicyEditComponent {
  constructor(
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

  /**
   * Step 1 ("how to turn on") title/content/footer templates. Protected (rather than private) so
   * the v2 variant of this component can reuse them unchanged - only step 0 differs between v1
   * and v2.
   */
  protected readonly step1Title: Signal<TemplateRef<unknown>> = viewChild.required("step1Title");
  protected readonly step1Content: Signal<TemplateRef<unknown>> =
    viewChild.required("step1Content");
  protected readonly step1Footer: Signal<TemplateRef<unknown>> = viewChild.required("step1Footer");

  protected readonly autoConfirmEnabled$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policies$(userId)),
      map(
        (policies) =>
          policies.find((p) => p.type === PolicyType.AutomaticUserConfirmation)?.enabled ?? false,
      ),
    );

  protected readonly singleOrgEnabled$: Observable<boolean> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policies$(userId)),
      map((policies) => policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false),
    );

  protected readonly managePoliciesOnly$: Observable<boolean> = this.organization$.pipe(
    map((organization) => (!organization?.isAdmin && organization?.canManagePolicies) ?? false),
  );

  protected readonly saveDisabled$ = combineLatest([
    this.autoConfirmEnabled$,
    this.enabled.valueChanges.pipe(startWith(this.enabled.value)),
  ]).pipe(map(([policyEnabled, value]) => !policyEnabled && !value));

  override readonly policySteps: PolicyStep[] = [
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

    const organization = await firstValueFrom(this.organization$);
    const managePoliciesOnly = (!organization?.isAdmin && organization?.canManagePolicies) ?? false;

    const policies = await firstValueFrom(this.policyService.policies$(userId));
    const singleOrgAlreadyEnabled =
      policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false;
    const enabledSingleOrgDuringAction = !singleOrgAlreadyEnabled;

    // AutoConfirm requires SingleOrg; enable it as a prerequisite if not already on.
    if (enabledSingleOrgDuringAction) {
      await this.policyApiService.putPolicy(this.organizationId() ?? "", PolicyType.SingleOrg, {
        policy: { enabled: true, data: null },
        metadata: null,
      });
    }

    try {
      const request = await this.buildRequest();
      await this.policyApiService.putPolicy(
        this.organizationId() ?? "",
        PolicyType.AutomaticUserConfirmation,
        request,
      );
    } catch (error) {
      // Roll back the SingleOrg enablement if AutoConfirm save fails.
      if (enabledSingleOrgDuringAction) {
        await this.policyApiService.putPolicy(this.organizationId() ?? "", PolicyType.SingleOrg, {
          policy: { enabled: false, data: null },
          metadata: null,
        });
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

  /**
   * Protected (rather than private) so the v2 variant of this component can reuse it unchanged
   * as the step 1 sideEffect - only step 0 differs between v1 and v2.
   */
  protected async navigateToExtensionPromptStep(): Promise<void> {
    await this.router.navigate(["/browser-extension-prompt"], {
      queryParams: { url: "AutoConfirm" },
    });
  }
}

/**
 * Drawer (v2) variant. Reuses step 1 ("how to turn on") and all save/rollback logic from the
 * standard component unchanged. Step 0 is replaced with a new template that:
 * - Renders the enable control as a switch (instead of a checkbox) labeled "Enable policy".
 * - Splits the single "I accept these risks..." checkbox out of the enable control into its own
 *   risk-confirmation checkbox, which gates (enables/disables) the switch.
 * - Uses a single, unconditional "Save and continue" footer button instead of the v1 footer's
 *   conditional "Save"/"Continue" label.
 */
@Component({
  selector: "auto-confirm-policy-v2-edit",
  templateUrl: "auto-confirm-policy-v2.component.html",
  imports: [SharedModule, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoConfirmPolicyEditV2Component extends AutoConfirmPolicyEditComponent {
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Gates the enable switch: an admin must accept the security risk before they can turn the
   * policy on. Defaults to accepted when editing an already-enabled policy, since the risk was
   * necessarily accepted the first time it was turned on. Public (matching {@link enabled}/
   * {@link data} on the base class) so it can be exercised directly from tests.
   */
  readonly riskAccepted = new FormControl(false, { nonNullable: true });

  private readonly step0ContentV2: Signal<TemplateRef<unknown>> =
    viewChild.required("step0ContentV2");
  private readonly step0FooterV2: Signal<TemplateRef<unknown>> =
    viewChild.required("step0FooterV2");

  override ngOnInit(): void {
    super.ngOnInit();

    this.riskAccepted.setValue(this.enabled.value ?? false);

    this.riskAccepted.valueChanges
      .pipe(startWith(this.riskAccepted.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((accepted) => {
        if (accepted) {
          this.enabled.enable({ emitEvent: false });
        } else {
          this.enabled.disable({ emitEvent: false });
          this.enabled.setValue(false);
        }
      });
  }

  override readonly policySteps: PolicyStep[] = [
    {
      bodyContent: this.step0ContentV2,
      footerContent: this.step0FooterV2,
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
}
