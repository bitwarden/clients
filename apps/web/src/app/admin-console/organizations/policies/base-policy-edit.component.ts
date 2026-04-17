import { Directive, OnInit, Signal, inject, input, signal } from "@angular/core";
import { FormControl, UntypedFormGroup } from "@angular/forms";
import { Observable, firstValueFrom, of, switchMap } from "rxjs";
import { Constructor } from "type-fest";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { VNextSavePolicyRequest } from "@bitwarden/common/admin-console/models/request/v-next-save-policy.request";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  ) => DialogRef<PolicyEditDialogResult>;
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
   * This is shown in the list of policies.
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
   * A method that determines whether to display this policy in the Admin Console Policies page.
   * The default implementation will always display the policy.
   * This can be used to hide the policy based on the organization's plan features or a feature flag value.
   * Note: this only hides the policy for editing in Admin Console, it does not affect its enforcement
   * if it has already been turned on. Enforcement should be feature flagged separately.
   */
  display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return of(true);
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
  readonly policyResponse = input<PolicyStatusResponse | undefined>(undefined);
  readonly policy = input<BasePolicyEditDefinition | undefined>(undefined);
  readonly currentStep = input<Signal<number>>(signal(0));
  readonly organizationId = input<string | undefined>(undefined);

  protected readonly accountService = inject(AccountService);
  protected readonly keyService = inject(KeyService);
  protected readonly policyApiService = inject(PolicyApiServiceAbstraction);

  /**
   * Whether the policy is enabled.
   */
  enabled = new FormControl(false);

  /**
   * An optional FormGroup for additional policy configuration. Required for more complex policies only.
   */
  data: UntypedFormGroup | undefined;

  /**
   * Optional multi-step configuration for policies that require multiple steps to complete.
   */
  policySteps?: PolicyStep[];

  ngOnInit(): void {
    this.enabled.setValue(this.policyResponse()?.enabled ?? false);

    if (this.policyResponse()?.data != null) {
      this.loadData();
    }
  }

  /**
   * An optional guard called before submission in {@link PolicyEditDialogComponent}.
   * Return `false` to abort the save (e.g. when the user cancels a warning dialog).
   * Components that need a confirmation step before saving should override this method.
   *
   * TODO: Remove this method when the `MigrateMyVaultToMyItems` feature flag is removed.
   * New policy components should use {@link policySteps} with a `sideEffect` instead.
   */
  confirm?(): Promise<boolean>;

  async buildVNextRequest(orgKey: OrgKey): Promise<VNextSavePolicyRequest> {
    if (!this.policy()) {
      throw new Error("Policy was not found");
    }

    const request: VNextSavePolicyRequest = {
      policy: await this.buildRequest(),
      metadata: null,
    };

    return request;
  }

  buildRequest() {
    if (!this.policy()) {
      throw new Error("Policy was not found");
    }

    const request: PolicyRequest = {
      enabled: this.enabled.value ?? false,
      data: this.buildRequestData(),
    };

    return Promise.resolve(request);
  }

  /**
   * Saves the policy via the vNext API. Subclasses that require additional steps or side effects
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

    if (orgKey == null) {
      throw new Error("No encryption key for this organization.");
    }

    const request = await this.buildVNextRequest(orgKey);

    await this.policyApiService.putPolicyVNext(
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
      return this.data.value;
    }

    return null;
  }
}
