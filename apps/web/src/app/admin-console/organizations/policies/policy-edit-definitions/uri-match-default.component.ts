import { Component, ChangeDetectionStrategy } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import { SwitchComponent } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class UriMatchDefaultPolicy extends BasePolicyEditDefinition {
  name = "uriMatchDetectionPolicy";
  description = "uriMatchDetectionPolicyDesc";
  type = PolicyType.UriMatchDefaults;
  category = PolicyCategory.VaultManagement;
  priority = 20;
  component = UriMatchDefaultPolicyComponent;
  v2 = {
    component: UriMatchDefaultPolicyV2Component,
    description: "uriMatchDetectionPolicyDescV2",
    prerequisiteKey: "requireSsoPolicyReqV2",
  };
}
@Component({
  selector: "uri-match-default-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "uri-match-default.component.html",
  imports: [SharedModule],
})
export class UriMatchDefaultPolicyComponent extends BasePolicyEditComponent {
  readonly uriMatchOptions: {
    label: string;
    value: UriMatchStrategySetting | null;
    disabled?: boolean;
  }[];

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
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
    const uriMatchDetection = this.policyResponse()?.data?.uriMatchDetection;

    this.data?.patchValue({
      uriMatchDetection: uriMatchDetection,
    });
  }

  protected buildRequestData() {
    return {
      uriMatchDetection: this.data?.value?.uriMatchDetection,
    };
  }

  override async buildRequest(orgKey?: OrgKey): Promise<SavePolicyRequest> {
    const request = await super.buildRequest(orgKey);
    if (request.policy.data?.uriMatchDetection == null) {
      throw new Error(this.i18nService.t("invalidUriMatchDefaultPolicySetting"));
    }

    return request;
  }
}

/**
 * Drawer (v2) variant. Reuses all form logic from the standard component and only swaps the
 * template: the enable toggle is rendered as a switch instead of a checkbox, and the prerequisite
 * callout is rendered by the surrounding PolicyEditDrawerComponent instead of the form.
 */
@Component({
  selector: "uri-match-default-v2-policy-edit",
  templateUrl: "uri-match-default-v2.component.html",
  imports: [SharedModule, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UriMatchDefaultPolicyV2Component extends UriMatchDefaultPolicyComponent {}
