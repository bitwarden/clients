import { Directive, OnInit, Signal, inject, input, signal } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { Observable, defer, firstValueFrom, of, switchMap } from "rxjs";
import { Constructor } from "type-fest";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { PolicyCategory } from "./pipes/policy-category";
import type { PolicyEditDialogData, PolicyEditDialogResult } from "./policy-edit-dialog.component";
import type { PolicyStep, PolicyStepResult } from "./policy-edit-dialogs/models";

/**
 * Interface for policy dialog components.
 * Any component that implements this interface can be used as a custom policy edit dialog.
 */
export interface PolicyDialogComponent {
  open: (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => DialogRef<PolicyEditDialogResult>;
  openDrawer?: (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => Promise<DialogRef<PolicyEditDialogResult> | undefined>;
}

/**
 * A metadata class that defines how a policy is displayed in the Admin Console Policies page for editing.
 * Add this to the `ossPolicyRegister` or `bitPolicyRegister` file to register it in the application.
 */
export abstract class BasePolicyEditDefinition {
  /**
   * i18n string for the policy name.
   */
  abstract name: string;
  /**
   * i18n string for the policy description.
   * This is shown in the list of policies and in the modal edit dialog.
   */
  abstract description: string;

  /**
   * The PolicyType enum that this policy represents.
   */
  abstract type: PolicyType;
  /**
   * The category this policy belongs to. Used to group policies on the Policies page.
   */
  abstract category: PolicyCategory;
  /**
   * The sort order of this policy within its category on the Policies page.
   * Lower numbers appear first. Values only need to be consistent relative to
   * other policies in the same category.
   */
  abstract priority: number;
  /**
   * The component used to edit this policy. See {@link BasePolicyEditComponent}.
   */
  abstract component: Constructor<BasePolicyEditComponent>;

  /**
   * The dialog component that will be opened when editing this policy.
   * This allows customizing the look and feel of each policy's dialog contents.
   */
  editDialogComponent?: PolicyDialogComponent;

  /**
   * If true, the {@link description} will be reused in the policy edit modal. Set this to false if you
   * have more complex requirements that you will implement in your template instead.
   **/
  showDescription: boolean = true;

  /**
   * If true, the dialog header shows an On/Off badge reflecting the saved policy state
   * and uses the policy name as the sole title (no "Edit policy" label).
   */
  showEnabledBadge: boolean = false;

  /**
   * Optional i18n key for a warning callout rendered by {@link PolicyEditDrawerComponent}
   * above the policy form.
   */
  warningKey?: string;

  /**
   * Optional drawer-specific configuration for this policy.
   * When set, {@link PolicyEditDrawerComponent} is used in place of the standard
   * modal dialog, loading {@link v2.component} and rendering the drawer-specific layout.
   * Drawer routing is gated globally by {@link FeatureFlag.PolicyDrawers} in
   * {@link PoliciesComponent} — there is no per-policy flag.
   */
  v2?: {
    /** Component to render inside the drawer instead of {@link component}. */
    component: Constructor<BasePolicyEditComponent>;
    /** Drawer-only title. Falls back to {@link name} when not set. */
    name?: string;
    /** Drawer-only description. Falls back to {@link description} when not set. */
    description?: string;
    /**
     * When set, overrides {@link showDescription} for the drawer only.
     * Set to false when the v2 component renders its own description (e.g. with an inline link).
     */
    showDescription?: boolean;
    /** i18n key for a prerequisite info callout rendered by {@link PolicyEditDrawerComponent} above the policy form. */
    prerequisiteKey?: string;
    /** URL for an optional "learn more" link inside the prerequisite callout. */
    prerequisiteLinkHref?: string;
    /** i18n key for the text of {@link prerequisiteLinkHref}. */
    prerequisiteLinkTextKey?: string;
  };

  /**
   * A method that determines whether to display this policy in the Admin Console Policies page.
   * The default implementation will always display the policy.
   * This can be used to hide the policy based on the organization's plan features or a feature flag value.
   * Note: this only hides the policy for editing in Admin Console, it does not affect its enforcement
   * if it has already been turned on. Enforcement should be feature flagged separately.
   */
  display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return of(true);
  }

  /**
   * Logic for displaying the policy status in the Admin Console.
   * If this returns true, the policy is shown as enabled. If false, it is shown as disabled.
   * This uses the `policy.enabled` value by default, which is appropriate for most cases.
   * You may wish to override this if the UI does not perfectly match the data model, e.g.
   * you wish to determine policy status based on a `policy.data` value.

   * Note: this only affects policy editing in Admin Console, it does not affect its enforcement.
   */
  enabled(policy: PolicyResponse): boolean {
    return policy.enabled;
  }
}

/**
 * A component used to edit the policy settings in Admin Console. It is rendered inside the PolicyEditDialogComponent.
 * This should contain the form controls used to edit the policy (including the Enabled checkbox) and any additional
 * warnings or callouts.
 * See existing implementations as a guide.
 */
@Directive()
export abstract class BasePolicyEditComponent implements OnInit {
  protected readonly accountService = inject(AccountService);
  protected readonly organizationServcie = inject(OrganizationService);
  protected readonly keyService = inject(KeyService);
  protected readonly policyApiService = inject(PolicyApiServiceAbstraction);

  readonly policyResponse = input<PolicyStatusResponse | undefined>(undefined);
  readonly policy = input<BasePolicyEditDefinition | undefined>(undefined);
  readonly currentStep = input<Signal<number>>(signal(0));
  readonly organizationId = input<string | undefined>(undefined);
  readonly organization$ = defer(() =>
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationServcie.organizations$(userId)),
      getById(this.organizationId() ?? this.policyResponse()?.organizationId),
    ),
  );

  /**
   * Whether the policy is enabled.
   */
  enabled = new FormControl(false);

  /**
   * An optional FormGroup for additional policy configuration. Required for more complex policies only.
   */
  data: FormGroup | undefined;

  /**
   * Optional multi-step configuration for policies that require multiple steps to complete.
   * Defaults to a single step that saves the policy.
   */
  policySteps: PolicyStep[] = [{ sideEffect: () => this.savePolicy() }];

  ngOnInit(): void {
    this.enabled.setValue(this.policyResponse()?.enabled ?? false);

    if (this.policyResponse()?.data != null) {
      this.loadData();
    }
  }

  async buildRequest(orgKey?: OrgKey): Promise<SavePolicyRequest> {
    if (!this.policy()) {
      throw new Error("Policy was not found");
    }

    return {
      policy: {
        enabled: this.enabled.value ?? false,
        data: this.buildRequestData(),
      },
      metadata: null,
    };
  }

  /**
   * Saves the policy. Subclasses that require additional steps or side effects
   * (e.g. enabling a prerequisite policy) should override this method.
   */
  protected async savePolicy(): Promise<PolicyStepResult | void> {
    if (!this.policy()) {
      throw new Error("Policy was not found");
    }

    const orgKeys = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => this.keyService.orgKeys$(userId)),
      ),
    );

    assertNonNullish(orgKeys, "Org keys not provided");

    const orgKey = orgKeys[this.organizationId() as OrganizationId];

    assertNonNullish(orgKey, "No encryption key for this organization.");

    const request = await this.buildRequest(orgKey);

    await this.policyApiService.putPolicy(
      this.organizationId() ?? "",
      this.policy()!.type,
      request,
    );
  }

  protected loadData() {
    this.data?.patchValue(this.policyResponse()?.data ?? {});
  }

  /**
   * Transforms the {@link data} FormGroup to the policy data model for saving.
   */
  protected buildRequestData() {
    if (this.data != null) {
      return this.data.getRawValue();
    }

    return null;
  }
}
