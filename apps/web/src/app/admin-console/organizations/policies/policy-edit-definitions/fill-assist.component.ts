import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import { DEFAULT_FILL_ASSIST_RULES_URL } from "@bitwarden/common/autofill/constants";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import { CheckboxModule, FormFieldModule, SwitchComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

function httpsUrlValidator(errorMessage: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }
    try {
      const parsed = new URL(control.value);
      if (parsed.protocol !== "https:") {
        return { url: { message: errorMessage } };
      }
      return null;
    } catch {
      return { url: { message: errorMessage } };
    }
  };
}

export class FillAssistPolicy extends BasePolicyEditDefinition {
  name = "fillAssistPolicy";
  description = "fillAssistPolicyDesc";
  // TODO(PM-41310): Replace with `PolicyType.FillAssist` once the SDK bump (PR 3) lands.
  // Value 22 is coordinated across sdk-internal, server, and clients repos.
  type = 22 as PolicyType;
  category = PolicyCategory.VaultManagement;
  priority = 25;
  component = FillAssistPolicyComponent;
  v2 = {
    component: FillAssistPolicyV2Component,
  };

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.FillAssistTargetingRules);
  }
}

@Component({
  selector: "fill-assist-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "fill-assist.component.html",
  imports: [ReactiveFormsModule, CheckboxModule, FormFieldModule, I18nPipe],
})
export class FillAssistPolicyComponent extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);

  constructor() {
    super();

    this.data = this.formBuilder.group({
      rulesUrl: new FormControl<string>(DEFAULT_FILL_ASSIST_RULES_URL, {
        validators: [
          Validators.required,
          httpsUrlValidator(this.i18nService.t("invalidFillAssistRulesUrl")),
        ],
        nonNullable: true,
      }),
    });
  }

  override async buildRequest(orgKey?: OrgKey): Promise<SavePolicyRequest> {
    const request = await super.buildRequest(orgKey);
    if (!request.policy.data?.rulesUrl) {
      throw new Error(this.i18nService.t("invalidFillAssistRulesUrl"));
    }

    return request;
  }
}

/**
 * Drawer (v2) variant. Reuses all form logic from the standard component and only swaps the
 * template: the enable toggle is rendered as a switch instead of a checkbox.
 */
@Component({
  selector: "fill-assist-v2-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "fill-assist-v2.component.html",
  imports: [ReactiveFormsModule, CheckboxModule, FormFieldModule, SwitchComponent, I18nPipe],
})
export class FillAssistPolicyV2Component extends FillAssistPolicyComponent {}
