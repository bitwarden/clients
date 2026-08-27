import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Observable, map } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import { DEFAULT_FILL_ASSIST_RULES_URL } from "@bitwarden/common/autofill/constants";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import {
  FormFieldModule,
  LinkModule,
  SwitchComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

/** Uneditable protocol prefix rendered ahead of the URL input via `bitPrefix`. */
const HTTPS_PREFIX = "https://";

/**
 * Case-insensitive match for a leading `https://`, including in-progress forms
 * (`https:`, `https:/`). Matching partial forms lets the validator treat mid-typing
 * input as a growing prefix rather than a scheme attempt.
 */
const HTTPS_PREFIX_PATTERN = /^https:\/?\/?/i;

/**
 * Strip the `https://` prefix if it is present in the URL. The template uses
 * `bitPrefix` to render an uneditable `https://` before the URL input, so the
 * form value omits the protocol to avoid showing it twice. `buildRequestData`
 * prepends `https://` back on save so stored values always use the https
 * protocol.
 */
function stripHttpsPrefix(value: string): string {
  return value.replace(HTTPS_PREFIX_PATTERN, "");
}

/**
 * Matches a scheme attempt at the start of the input (per RFC 3986 scheme syntax, minus `.`
 * — we intentionally exclude `.` so this does not false-positive on hostnames like
 * `example.com:`). We accept only https; this pattern catches every other scheme attempt
 * so the validator can reject them.
 */
const SCHEME_ATTEMPT = /^[a-z][a-z0-9+-]*:/i;

/**
 * Validates the input's host/path portion. Any leading `https://` (or in-progress
 * forms `https:`, `https:/`) is stripped here first so the validator's view matches
 * what the blur handler will leave in the input.
 *
 * Any remaining scheme attempt after that strip is an unsupported protocol (`http`,
 * `ftp`, etc.) — including the single-slash `http:/foo` form that the WHATWG URL
 * parser would otherwise accept as an empty-port hostname.
 */
function hostPathValidator(errorMessage: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: string = control.value;
    if (!raw) {
      return null;
    }
    const value = stripHttpsPrefix(raw);
    if (!value) {
      // Nothing but a partial `https://` prefix — treat as incomplete input.
      return { url: { message: errorMessage } };
    }
    if (SCHEME_ATTEMPT.test(value)) {
      return { url: { message: errorMessage } };
    }
    try {
      new URL(HTTPS_PREFIX + value);
      return null;
    } catch {
      return { url: { message: errorMessage } };
    }
  };
}

export class FillAssistPolicy extends BasePolicyEditDefinition {
  name = "fillAssistPolicy";
  description = "fillAssistPolicyDesc";
  type = PolicyType.FillAssist;
  category = PolicyCategory.VaultManagement;
  priority = 25;
  component = FillAssistPolicyComponent;
  // The component renders its own description paragraph so the "Learn more"
  // link can be inlined; suppress the framework's plain-text rendering.
  showDescription = false;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.FillAssistTargetingRules);
  }
}

@Component({
  selector: "fill-assist-policy-edit",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "fill-assist.component.html",
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    FormFieldModule,
    LinkModule,
    SwitchComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class FillAssistPolicyComponent extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly environmentService = inject(EnvironmentService);

  // Self-hosted deployments configure the rules feed via their server config,
  // not per-org — so the URL field is hidden and only the enable toggle is shown.
  protected readonly isCloud$: Observable<boolean> = this.environmentService.environment$.pipe(
    map((env) => env.isCloud()),
  );

  constructor() {
    super();

    this.data = this.formBuilder.group({
      rulesUrl: new FormControl<string>(stripHttpsPrefix(DEFAULT_FILL_ASSIST_RULES_URL), {
        validators: [
          Validators.required,
          hostPathValidator(this.i18nService.t("invalidFillAssistRulesUrl")),
        ],
        nonNullable: true,
      }),
    });

    // Mirror the policy's enabled/disabled state to the URL field. Let enable/disable
    // emit their events so the parent form's `statusChanges` re-publishes — otherwise
    // a cached `INVALID` from an earlier bad URL would leave Save stuck disabled after
    // toggling the policy off.
    this.enabled.valueChanges.pipe(takeUntilDestroyed()).subscribe((isEnabled) => {
      const control = this.data?.controls.rulesUrl;
      if (!control) {
        return;
      }
      if (isEnabled) {
        control.enable();
      } else {
        control.disable();
      }
    });
  }

  /**
   * Strip a leading `https://` prefix so the input aligns with the uneditable
   * prefix shown ahead of it. Bound to blur rather than every keystroke so the
   * cleanup doesn't move the caret mid-typing.
   */
  protected onRulesUrlBlur(): void {
    const control = this.data?.controls.rulesUrl;
    const value = control?.value;
    if (typeof value === "string" && HTTPS_PREFIX_PATTERN.test(value)) {
      control!.setValue(stripHttpsPrefix(value));
    }
  }

  protected override loadData() {
    const data = this.policyResponse()?.data;
    if (!data) {
      return;
    }
    // Only override rulesUrl in the patch if we have a string to strip.
    // Otherwise `patchValue({ rulesUrl: undefined })` would blank out the
    // constructor default for policies stored with no rulesUrl.
    const patch: { [key: string]: unknown } = { ...data };
    if (typeof data.rulesUrl === "string") {
      patch.rulesUrl = stripHttpsPrefix(data.rulesUrl);
    } else {
      delete patch.rulesUrl;
    }
    this.data?.patchValue(patch);
  }

  // Prepend `https://` back so the stored policy data is a canonical full URL.
  // Strip first to stay idempotent — submitting with Enter skips the blur
  // handler, so the form value may still carry a pasted `https://` prefix.
  // Trim before that: the URL constructor tolerates surrounding whitespace,
  // so `"example.com/rules "` slips past the validator; without trimming here
  // the space percent-encodes when the client joins the URL with the manifest
  // filename and silently 404s. Also strip trailing slashes so the stored
  // value is canonical and downstream URL composition stays consistent.
  protected override buildRequestData() {
    const data = this.data?.getRawValue();
    if (data == null) {
      return null;
    }
    const rulesUrl =
      typeof data.rulesUrl === "string" ? data.rulesUrl.trim().replace(/\/+$/, "") : data.rulesUrl;
    return {
      ...data,
      rulesUrl: rulesUrl ? HTTPS_PREFIX + stripHttpsPrefix(rulesUrl) : rulesUrl,
    };
  }

  override async buildRequest(orgKey?: OrgKey): Promise<SavePolicyRequest> {
    const request = await super.buildRequest(orgKey);
    // Only require a URL when the policy is being enabled — a policy that's off
    // is allowed to persist without one (the client-side reader falls through
    // to server config or the hardcoded default in that case).
    if (request.policy.enabled && !request.policy.data?.rulesUrl) {
      throw new Error(this.i18nService.t("invalidFillAssistRulesUrl"));
    }

    return request;
  }
}
