import { Component } from "@angular/core";
import { FormBuilder, FormControl } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
// TODO: Remove unused imports if we won't use a feature flag
// import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
// import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
// import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";

export class UriMatchDefaultPolicy extends BasePolicyEditDefinition {
  name = "uriMatchDetectionPolicy";
  description = "uriMatchDetectionDesc";
  type = PolicyType.UriMatchDefaults;
  component = UriMatchDefaultPolicyComponent;

  // TODO: Remove if we won't use a feature flag
  // display$(organization: Organization, configService: ConfigService) {
  //   return configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype);
  // }
}
@Component({
  templateUrl: "uri-match-default.component.html",
  imports: [SharedModule],
})
export class UriMatchDefaultPolicyComponent extends BasePolicyEditComponent {
  uriMatchOptions: { label: string; value: UriMatchStrategySetting | null; disabled?: boolean }[];
  data = this.formBuilder.group({
    uriMatchDetection: new FormControl<string>(null),
  });

  constructor(
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {
    super();
    this.uriMatchOptions = [
      { label: "-- Select --", value: null },
      { label: i18nService.t("baseDomain"), value: UriMatchStrategy.Domain },
      { label: i18nService.t("host"), value: UriMatchStrategy.Host },
      { label: i18nService.t("exact"), value: UriMatchStrategy.Exact },
      { label: i18nService.t("never"), value: UriMatchStrategy.Never },
      { label: this.i18nService.t("uriAdvancedOption"), value: null, disabled: true },
      { label: i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
      { label: i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
    ];
  }

  protected loadData() {
    const uriMatchDetection = this.policyResponse.data?.uriMatchDetection;

    this.data.patchValue({
      uriMatchDetection: uriMatchDetection,
    });
  }

  protected buildRequestData() {
    return {
      uriMatchDetection: this.data.value.uriMatchDetection,
    };
  }

  async buildRequest(): Promise<PolicyRequest> {
    const request = await super.buildRequest();
    if (request.data?.uriMatchDetection == null) {
      throw new Error(this.i18nService.t("invalidMaximumVaultTimeout"));
    }

    return request;
  }
}
