import { Directive, Input, OnInit } from "@angular/core";
import { FormControl, UntypedFormGroup } from "@angular/forms";
import { Observable, of } from "rxjs";
import { Constructor } from "type-fest";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * A metadata class that defines how a policy is displayed in the Admin Console Policies page for editing.
 * Add this to the `policy-register.ts` file (in OSS or Bitwarden Licensed code) to register it in the application.
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
   * The component used to edit this policy. See {@link BasePolicyEditComponent}.
   */
  abstract component: Constructor<BasePolicyEditComponent>;

  /**
   * If true, the {@link description} will be reused in the policy edit modal. Set this to false if you
   * have more complex requirements that you will implement in your template instead.
   **/
  showDescription: boolean = true;

  /**
   * A method that determines whether to display this policy in the Admin Console Policies page.
   * The default implementation will always display the policy.
   * This can be used to hide the policy based on the organization's plan features or a feature flag value.
   * Use this to feature flag new policy implementations.
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
  @Input() policyResponse: PolicyResponse | undefined;
  @Input() policy: BasePolicyEditDefinition | undefined;

  /**
   * Whether the policy is enabled.
   */
  enabled = new FormControl(false);

  /**
   * An optional FormGroup for additional policy configuration. Required for more complex policies only.
   */
  data: UntypedFormGroup | undefined;

  ngOnInit(): void {
    this.enabled.setValue(this.policyResponse?.enabled ?? false);

    if (this.policyResponse?.data != null) {
      this.loadData();
    }
  }

  buildRequest() {
    if (!this.policy) {
      throw new Error("Policy was not found");
    }

    const request: PolicyRequest = {
      type: this.policy.type,
      enabled: this.enabled.value ?? false,
      data: this.buildRequestData(),
    };

    return Promise.resolve(request);
  }

  /**
   * This is called before the policy is saved. If it returns false, it will not be saved
   * and the user will remain on the policy edit dialog.
   * This can be used to trigger an additional confirmation modal before saving.
   * */
  confirm(): Promise<boolean> | boolean {
    return true;
  }

  protected loadData() {
    this.data?.patchValue(this.policyResponse?.data ?? {});
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
