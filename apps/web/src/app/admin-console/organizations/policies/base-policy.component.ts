// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, Input, OnInit } from "@angular/core";
import { UntypedFormControl, UntypedFormGroup } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";

export abstract class BasePolicy {
  abstract name: string;
  abstract description: string;
  abstract type: PolicyType;
  abstract component: any;

  display(organization: Organization) {
    return true;
  }
}

@Directive()
export abstract class BasePolicyComponent implements OnInit {
  @Input() policyResponse: PolicyResponse;
  @Input() policy: BasePolicy;

  enabled = new UntypedFormControl(false);
  data: UntypedFormGroup = null;

  ngOnInit(): void {
    this.enabled.setValue(this.policyResponse.enabled);

    if (this.policyResponse.data != null) {
      this.loadData();
    }
  }

  buildRequest() {
    const request = new PolicyRequest();
    request.enabled = this.enabled.value;
    request.type = this.policy.type;
    request.data = this.buildRequestData();

    return Promise.resolve(request);
  }

  protected loadData() {
    this.data.patchValue(this.policyResponse.data ?? {});
  }

  protected buildRequestData() {
    if (this.data != null) {
      return this.data.value;
    }

    return null;
  }
}
