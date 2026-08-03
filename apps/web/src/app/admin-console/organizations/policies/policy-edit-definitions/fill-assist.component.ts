import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ValidationErrors,
  Validators,
} from "@angular/forms";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

// TODO(PM-41310): Extract to a shared constant in libs/common/src/autofill/ once PR 5 (enforcement)
// also needs it for the "differs from default" comparison.
const DEFAULT_FILL_ASSIST_RULES_URL =
  "https://github.com/bitwarden/map-the-web/releases/latest/download";

function urlValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) {
    return null;
  }
  try {
    new URL(control.value);
    return null;
  } catch {
    return { url: true };
  }
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
}

@Component({
  selector: "fill-assist-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "fill-assist.component.html",
  imports: [SharedModule],
})
export class FillAssistPolicyComponent extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);

  constructor() {
    super();

    this.data = this.formBuilder.group({
      rulesUrl: new FormControl<string>(DEFAULT_FILL_ASSIST_RULES_URL, {
        validators: [Validators.required, urlValidator],
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
