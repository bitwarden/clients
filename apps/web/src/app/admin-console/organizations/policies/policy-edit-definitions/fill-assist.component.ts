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
} from "@angular/forms";
import { Observable, map, startWith } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import {
  DEFAULT_FILL_ASSIST_RULES_URL,
  LEGACY_DEFAULT_FILL_ASSIST_RULES_URLS,
} from "@bitwarden/common/autofill/constants";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import {
  FormFieldModule,
  LinkModule,
  RadioButtonModule,
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
 * Validates a required host/path portion. Empty input, a bare partial `https://`
 * prefix, an unsupported protocol attempt, or anything the WHATWG URL parser
 * rejects all fail with the same `{ url: { message } }` shape — so the
 * form-field renders a single consistent error message from the caller instead
 * of the framework's default "required" text.
 *
 * Any leading `https://` (or in-progress forms `https:`, `https:/`) is stripped
 * first so the validator's view matches what the blur handler will leave in
 * the input. A scheme attempt after that strip is an unsupported protocol
 * (`http`, `ftp`, etc.), including the single-slash `http:/foo` form that the
 * WHATWG URL parser would otherwise accept as an empty-port hostname.
 */
function requiredHostPathValidator(errorMessage: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw: string = control.value;
    if (!raw) {
      // Required check surfaces the caller's message rather than the default.
      return { url: { message: errorMessage } };
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

/** Options for the rule-source radio group. */
export const RuleSource = Object.freeze({
  Default: "default",
  Custom: "custom",
} as const);
export type RuleSource = (typeof RuleSource)[keyof typeof RuleSource];

/**
 * True if the stored URL should be interpreted as "use the default rules."
 * Empty/absent URL, the current default constant, or any historical default
 * value all count as Default. Legacy policies saved before the current
 * constant value was adopted are recognized via the historical set — see
 * `libs/common/src/autofill/constants/index.ts`.
 */
function isDefaultRulesUrl(url: string | null | undefined): boolean {
  if (!url) {
    return true;
  }
  return url === DEFAULT_FILL_ASSIST_RULES_URL || LEGACY_DEFAULT_FILL_ASSIST_RULES_URLS.has(url);
}

export class FillAssistPolicy extends BasePolicyEditDefinition {
  name = "fillAssistPolicy";
  description = "fillAssistPolicyDesc";
  type = PolicyType.FillAssist;
  category = PolicyCategory.VaultManagement;
  priority = 25;
  component = FillAssistPolicyComponent;
  prerequisiteKey = "requireSingleOrganizationPolicy";
  prerequisiteKeyVfo1 = "requireSingleOrganizationPolicyVfo1";

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
    RadioButtonModule,
    SwitchComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class FillAssistPolicyComponent extends BasePolicyEditComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly environmentService = inject(EnvironmentService);

  protected readonly RuleSource = RuleSource;

  // Self-hosted deployments configure the rules feed via their server config,
  // not per-org — so the URL field is hidden and only the enable toggle is shown.
  protected readonly isCloud$: Observable<boolean> = this.environmentService.environment$.pipe(
    map((env) => env.isCloud()),
  );

  constructor() {
    super();

    this.data = this.formBuilder.group({
      ruleSource: new FormControl<RuleSource>(RuleSource.Default, { nonNullable: true }),
      rulesUrl: new FormControl<string>("", { nonNullable: true }),
    });

    const ruleSourceControl = this.data.controls.ruleSource;
    const rulesUrlControl = this.data.controls.rulesUrl;

    // Default source doesn't need a URL; disable the field so validators don't
    // block the form. The disable/enable cycle preserves the value, so a URL
    // entered under Custom survives toggling to Default and back — admin can
    // cancel a mid-edit change without losing their input.
    rulesUrlControl.disable();

    ruleSourceControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((source) => {
      if (source === RuleSource.Custom) {
        rulesUrlControl.enable();
      } else {
        rulesUrlControl.disable();
      }
    });

    // URL validators only apply when the policy is enabled — an inert URL
    // shouldn't block Save on a policy that's off. `updateValueAndValidity`
    // must emit (default) so the drawer's `saveDisabled` sees the form become
    // valid when we clear validators (it reads `data.statusChanges`).
    this.enabled.valueChanges
      .pipe(startWith(this.enabled.value), takeUntilDestroyed())
      .subscribe((policyEnabled) => {
        if (policyEnabled) {
          rulesUrlControl.setValidators([
            requiredHostPathValidator(this.i18nService.t("invalidFillAssistRulesUrl")),
          ]);
        } else {
          rulesUrlControl.clearValidators();
        }
        rulesUrlControl.updateValueAndValidity();
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
    const storedUrl = typeof data.rulesUrl === "string" ? data.rulesUrl : undefined;
    const isDefault = isDefaultRulesUrl(storedUrl);
    this.data?.patchValue({
      ruleSource: isDefault ? RuleSource.Default : RuleSource.Custom,
      rulesUrl: isDefault ? "" : stripHttpsPrefix(storedUrl!),
    });
  }

  protected override buildRequestData() {
    const data = this.data?.getRawValue();
    if (data == null) {
      return null;
    }
    // Submit the default constant as a sentinel: the client resolver
    // (`effectiveFillAssistRulesUrl$` in `domain-settings.service.ts`) treats
    // this stored value as "fall through to server config." See the constants
    // file for migration constraints if this value ever changes.
    if (data.ruleSource === RuleSource.Default) {
      return { rulesUrl: DEFAULT_FILL_ASSIST_RULES_URL };
    }
    // Prepend `https://` back so the stored policy data is a canonical full URL.
    // Strip first to stay idempotent — submitting with Enter skips the blur
    // handler, so the form value may still carry a pasted `https://` prefix.
    // Trim before that: the URL constructor tolerates surrounding whitespace,
    // so `"example.com/rules "` slips past the validator; without trimming here
    // the space percent-encodes when the client joins the URL with the manifest
    // filename and silently 404s. Also strip trailing slashes so the stored
    // value is canonical and downstream URL composition stays consistent.
    const rulesUrl =
      typeof data.rulesUrl === "string" ? data.rulesUrl.trim().replace(/\/+$/, "") : data.rulesUrl;
    return {
      rulesUrl: rulesUrl ? HTTPS_PREFIX + stripHttpsPrefix(rulesUrl) : rulesUrl,
    };
  }

  override async buildRequest(orgKey?: OrgKey): Promise<SavePolicyRequest> {
    const request = await super.buildRequest(orgKey);
    // Only require a URL when the policy is being enabled AND the admin has
    // chosen a Custom rule source. Default source has no URL to validate; a
    // disabled policy is allowed to persist without one.
    const isCustom = this.data?.value?.ruleSource === RuleSource.Custom;
    if (request.policy.enabled && isCustom && !request.policy.data?.rulesUrl) {
      throw new Error(this.i18nService.t("invalidFillAssistRulesUrl"));
    }

    return request;
  }
}
