import { Component, ChangeDetectionStrategy } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class UriMatchDefaultPolicy extends BasePolicyEditDefinition {
  name = "uriMatchDetectionPolicy";
  description = "uriMatchDetectionPolicyDesc";
  type = PolicyType.UriMatchDefaults;
  component = UriMatchDefaultPolicyComponent;
}
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "uri-match-default.component.html",
  imports: [SharedModule],
})
export class UriMatchDefaultPolicyComponent extends BasePolicyEditComponent {
  uriMatchOptions: { label: string; value: UriMatchStrategySetting | null; disabled?: boolean }[];

  constructor(
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {
    super();

    this.data = this.formBuilder.group({
      uriMatchDetection: new FormControl<UriMatchStrategySetting>(UriMatchStrategy.Domain, {
        validators: [Validators.required],
        nonNullable: true,
      }),
    });

    this.uriMatchOptions = [
      { label: i18nService.t("baseDomain"), value: UriMatchStrategy.Domain },
      { label: i18nService.t("host"), value: UriMatchStrategy.Host },
      { label: i18nService.t("exact"), value: UriMatchStrategy.Exact },
      { label: i18nService.t("never"), value: UriMatchStrategy.Never },
    ];
  }

  protected loadData() {
    const uriMatchDetection = this.policyResponse?.data?.uriMatchDetection;

    this.data?.patchValue({
      uriMatchDetection: uriMatchDetection,
    });
  }

  protected buildRequestData() {
    return {
      uriMatchDetection: this.data?.value?.uriMatchDetection,
    };
  }

  async buildRequest(): Promise<PolicyRequest> {
    const request = await super.buildRequest();
    if (request.data?.uriMatchDetection == null) {
      throw new Error(this.i18nService.t("invalidUriMatchDefaultPolicySetting"));
    }

    return request;
  }
}
