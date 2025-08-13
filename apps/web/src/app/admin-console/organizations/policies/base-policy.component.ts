import { Directive, Input, OnInit } from "@angular/core";
import { UntypedFormControl, UntypedFormGroup } from "@angular/forms";
import { Observable, of } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

export abstract class BasePolicy {
  abstract name: string;
  abstract description: string;
  abstract type: PolicyType;
  abstract component: any;

  /**
   * If true, the description will be reused in the policy edit modal. Set this to false if you
   * have more complex requirements that you will implement in your template instead.
   **/
  showDescription: boolean = true;

  display(organization: Organization, configService: ConfigService): Observable<boolean> {
    return of(true);
  }
}

@Directive()
export abstract class BasePolicyComponent implements OnInit {
  @Input() policyResponse: PolicyResponse | undefined;
  @Input() policy: BasePolicy | undefined;

  enabled = new UntypedFormControl(false);
  data: UntypedFormGroup | undefined;

  ngOnInit(): void {
    this.enabled.setValue(this.policyResponse?.enabled);

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
      enabled: this.enabled.value,
      data: this.buildRequestData(),
    };

    return Promise.resolve(request);
  }

  /**
   * Enable optional validation before sumitting a respose for policy submission
   * */
  confirm(): Promise<boolean> | boolean {
    return true;
  }

  protected loadData() {
    this.data?.patchValue(this.policyResponse?.data ?? {});
  }

  protected buildRequestData() {
    if (this.data != null) {
      return this.data.value;
    }

    return null;
  }
}
