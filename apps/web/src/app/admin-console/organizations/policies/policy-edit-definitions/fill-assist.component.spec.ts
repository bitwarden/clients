import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { FillAssistPolicy, FillAssistPolicyComponent, RuleSource } from "./fill-assist.component";

const ORG_ID = "org1" as OrganizationId;
const USER_ID = "user1" as UserId;
const DEFAULT_URL = "https://fillassist.bitwarden.com";
// A historical value of DEFAULT_FILL_ASSIST_RULES_URL that must still be
// recognized as "Default" by the UI so legacy policies don't silently flip
// to Custom. Kept in sync with LEGACY_DEFAULT_FILL_ASSIST_RULES_URLS in
// libs/common/src/autofill/constants/index.ts.
const LEGACY_GITHUB_URL = "https://github.com/bitwarden/map-the-web/releases/latest/download";
const CUSTOM_URL = "https://custom.example.com/rules";
// Host+path form of a custom URL (the `https://` is rendered as an uneditable
// `bitPrefix` in the template).
const CUSTOM_URL_HOST_PATH = "custom.example.com/rules";

function makePolicyResponse(enabled: boolean, data: object | null = null) {
  return new PolicyStatusResponse({
    OrganizationId: ORG_ID,
    Type: PolicyType.FillAssist,
    Enabled: enabled,
    Data: data,
  });
}

describe("FillAssistPolicy", () => {
  it("has correct attributes", () => {
    const policy = new FillAssistPolicy();

    expect(policy.name).toBe("fillAssistPolicyV2");
    expect(policy.description).toBe("fillAssistPolicyDesc");
    expect(policy.type).toBe(PolicyType.FillAssist);
    expect(policy.component).toBe(FillAssistPolicyComponent);
    expect(policy.prerequisiteKey).toBe("requireSingleOrganizationPolicy");
    expect(policy.prerequisiteKeyVfo1).toBe("requireSingleOrganizationPolicyVfo1");
  });

  it("gates display$ on the FillAssistTargetingRules feature flag when enabled", async () => {
    const policy = new FillAssistPolicy();
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));

    const result = await firstValueFrom(policy.display$({} as Organization, configService));

    expect(result).toBe(true);
    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.FillAssistTargetingRules,
    );
  });

  it("hides display$ when the FillAssistTargetingRules feature flag is off", async () => {
    const policy = new FillAssistPolicy();
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    const result = await firstValueFrom(policy.display$({} as Organization, configService));

    expect(result).toBe(false);
  });

  it("renders inside the drawer via the single component definition", () => {
    const policy = new FillAssistPolicy();

    expect(policy.component).toBe(FillAssistPolicyComponent);
    expect(policy.v2).toBeUndefined();
  });
});

describe("FillAssistPolicyComponent", () => {
  let component: FillAssistPolicyComponent;
  let fixture: ComponentFixture<FillAssistPolicyComponent>;
  let accountService: FakeAccountService;
  let environmentSubject: BehaviorSubject<Environment>;

  function makeEnvironment(isCloud: boolean): Environment {
    const env = mock<Environment>();
    env.isCloud.mockReturnValue(isCloud);
    return env;
  }

  beforeEach(async () => {
    accountService = mockAccountServiceWith(USER_ID);
    environmentSubject = new BehaviorSubject<Environment>(makeEnvironment(true));
    const environmentService = mock<EnvironmentService>();
    (environmentService as any).environment$ = environmentSubject;

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
        { provide: AccountService, useValue: accountService },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
        { provide: EnvironmentService, useValue: environmentService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(FillAssistPolicyComponent);
    component = fixture.componentInstance;
  });

  describe("initial state", () => {
    it("defaults ruleSource to Default", () => {
      expect(component.data?.value?.ruleSource).toBe(RuleSource.Default);
    });

    it("starts with rulesUrl empty (no user input yet)", () => {
      expect(component.data?.controls.rulesUrl.value).toBe("");
    });

    it("disables the rulesUrl control on init (Default is selected)", () => {
      // Default source doesn't need a URL, so the URL control is disabled to
      // exclude it from form validation. Enabled only when Custom is selected.
      expect(component.data?.controls.rulesUrl.disabled).toBe(true);
    });
  });

  describe("loadData", () => {
    it("selects Default and clears rulesUrl when policy data has no rulesUrl field", () => {
      // The server returns `{}` (not `null`) for a policy that has never been
      // configured; base class calls loadData with that empty object.
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false, {}));

      component.ngOnInit();

      expect(component.data?.value?.ruleSource).toBe(RuleSource.Default);
      expect(component.data?.controls.rulesUrl.value).toBe("");
    });

    it("leaves initial state when policy data is null (no loadData call)", () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false, null));

      component.ngOnInit();

      expect(component.data?.value?.ruleSource).toBe(RuleSource.Default);
      expect(component.data?.controls.rulesUrl.value).toBe("");
    });

    it("selects Default when stored rulesUrl matches the current default constant", () => {
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(true, { rulesUrl: DEFAULT_URL }),
      );

      component.ngOnInit();

      expect(component.data?.value?.ruleSource).toBe(RuleSource.Default);
      expect(component.data?.controls.rulesUrl.value).toBe("");
    });

    it("selects Default when stored rulesUrl is a legacy default value", () => {
      // Locks in the legacy-URL recognition: policies saved before the
      // current default constant was adopted must not silently flip to
      // Custom pointing at the old URL. Keeps legacy policies from surprising
      // admins in the UI.
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(true, { rulesUrl: LEGACY_GITHUB_URL }),
      );

      component.ngOnInit();

      expect(component.data?.value?.ruleSource).toBe(RuleSource.Default);
      expect(component.data?.controls.rulesUrl.value).toBe("");
    });

    it("selects Custom and populates rulesUrl (host+path) when stored URL is not a default", () => {
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(true, { rulesUrl: CUSTOM_URL }),
      );

      component.ngOnInit();

      expect(component.data?.value?.ruleSource).toBe(RuleSource.Custom);
      expect(component.data?.value?.rulesUrl).toBe(CUSTOM_URL_HOST_PATH);
    });
  });

  describe("radio switching", () => {
    it("enables the rulesUrl control when the admin switches to Custom", () => {
      component.data?.patchValue({ ruleSource: RuleSource.Custom });

      expect(component.data?.controls.rulesUrl.enabled).toBe(true);
    });

    it("disables the rulesUrl control when the admin switches back to Default", () => {
      component.data?.patchValue({ ruleSource: RuleSource.Custom });
      component.data?.patchValue({ ruleSource: RuleSource.Default });

      expect(component.data?.controls.rulesUrl.disabled).toBe(true);
    });

    it("preserves the rulesUrl value across radio toggles within the session", () => {
      // Within-session URL preservation: an admin who enters a URL, briefly
      // switches to Default, then switches back should not lose their input.
      // Lets them cancel a change without re-typing.
      component.data?.patchValue({ ruleSource: RuleSource.Custom });
      component.data?.patchValue({ rulesUrl: "example.com/rules" });
      component.data?.patchValue({ ruleSource: RuleSource.Default });
      component.data?.patchValue({ ruleSource: RuleSource.Custom });

      expect(component.data?.controls.rulesUrl.value).toBe("example.com/rules");
    });
  });

  describe("URL validation (Custom source, policy enabled)", () => {
    beforeEach(() => {
      // URL validators fire only when the policy is enabled AND Custom is
      // selected. Policy-off skips URL validation entirely so an admin can
      // save-and-disable without also fixing a URL that's about to become
      // inert.
      component.enabled.setValue(true);
      component.data?.patchValue({ ruleSource: RuleSource.Custom });
    });

    it("marks the form invalid when rulesUrl is empty", () => {
      component.data?.patchValue({ rulesUrl: "" });

      expect(component.data?.invalid).toBe(true);
    });

    it("reports the custom error message when rulesUrl is empty", () => {
      // Empty and invalid URL share the same error shape so the form field
      // renders the caller's message rather than the framework's default
      // "required" text.
      component.data?.patchValue({ rulesUrl: "" });

      expect(component.data?.get("rulesUrl")?.errors).toEqual({
        url: { message: "invalidFillAssistRulesUrlV2" },
      });
    });

    it("marks the form invalid when rulesUrl is not a valid URL", () => {
      component.data?.patchValue({ rulesUrl: "not a url" });

      expect(component.data?.invalid).toBe(true);
    });

    it("accepts a valid host+path value", () => {
      component.data?.patchValue({ rulesUrl: "example.com/rules" });

      expect(component.data?.valid).toBe(true);
    });
  });

  describe("form validity with Default selected", () => {
    it("is valid even when rulesUrl is empty", () => {
      // Default doesn't require a URL, so the URL control is disabled and
      // its validators don't affect form validity.
      component.data?.patchValue({ ruleSource: RuleSource.Default, rulesUrl: "" });

      expect(component.data?.valid).toBe(true);
    });
  });

  describe("form validity when the policy is disabled", () => {
    it("is valid when Custom + empty URL if the policy toggle is off", () => {
      // The URL is inert when the policy is off (never fetched, never used),
      // so it shouldn't block Save. This is the fix for the case where an
      // admin toggles the policy off after seeing a URL validation error and
      // finds the Save button still disabled.
      component.enabled.setValue(false);
      component.data?.patchValue({ ruleSource: RuleSource.Custom, rulesUrl: "" });

      expect(component.data?.valid).toBe(true);
    });

    it("is valid when Custom + invalid URL if the policy toggle is off", () => {
      component.enabled.setValue(false);
      component.data?.patchValue({ ruleSource: RuleSource.Custom, rulesUrl: "not a url" });

      expect(component.data?.valid).toBe(true);
    });
  });

  describe("protocol handling on user input (Custom source, policy enabled)", () => {
    beforeEach(() => {
      // URL validators only fire when the policy is enabled AND Custom is
      // selected. These tests exercise the URL validator branches, so both
      // conditions must hold.
      component.enabled.setValue(true);
      component.data?.patchValue({ ruleSource: RuleSource.Custom });
    });

    it("strips https:// prefix on blur", () => {
      component.data?.patchValue({ rulesUrl: "https://example.com/rules" });
      (component as any).onRulesUrlBlur();

      expect(component.data?.value?.rulesUrl).toBe("example.com/rules");
      expect(component.data?.valid).toBe(true);
    });

    it("strips https:// prefix on blur (case-insensitive)", () => {
      component.data?.patchValue({ rulesUrl: "HTTPS://example.com/rules" });
      (component as any).onRulesUrlBlur();

      expect(component.data?.value?.rulesUrl).toBe("example.com/rules");
      expect(component.data?.valid).toBe(true);
    });

    it.each([
      ["https:example.com/rules"], // colon only
      ["https:/example.com/rules"], // single slash
      ["https://example.com/rules"], // complete
    ])("keeps the form valid while an https:// prefix is being typed: %s", (mid) => {
      // Save must stay enabled through the whole `https://` typing window —
      // a `https:` fragment mid-prefix must not read as a scheme attempt.
      component.data?.patchValue({ rulesUrl: mid });

      expect(component.data?.valid).toBe(true);
    });

    it.each([
      ["http://example.com/rules"],
      ["ftp://example.com/rules"],
      ["javascript:alert(1)"],
      ["mailto:x@y.com"],
      // Single-slash form: WHATWG URL parser would leniently accept
      // "https://http:/example.com" as a hostname `http` with empty port,
      // so this must be caught explicitly.
      ["http:/example.com/rules"],
      // No-slash form: also a scheme attempt.
      ["http:example.com/rules"],
    ])("rejects non-https protocol: %s", (url) => {
      component.data?.patchValue({ rulesUrl: url });

      expect(component.data?.invalid).toBe(true);
      expect(component.data?.get("rulesUrl")?.errors).toEqual({
        url: { message: "invalidFillAssistRulesUrlV2" },
      });
    });

    it.each([
      // Colon in path/query/fragment — legit URL constructs, must not be flagged
      // as scheme attempts by the validator.
      ["example.com/git:/main"],
      ["example.com/segment:/other"],
      ["example.com/foo?x=:/bar"],
      ["example.com/foo#:/bar"],
    ])("accepts colon+slash inside path/query/fragment: %s", (url) => {
      component.data?.patchValue({ rulesUrl: url });

      expect(component.data?.valid).toBe(true);
    });
  });

  describe("buildRequest — Default source", () => {
    it("submits DEFAULT_FILL_ASSIST_RULES_URL when Default is selected", async () => {
      // This test locks in the sentinel behavior: the client stores the
      // default constant as a signal meaning "use the current default,"
      // and the resolver falls through to server config on read. Changing
      // this behavior would silently break existing "Default" policies —
      // see comments on DEFAULT_FILL_ASSIST_RULES_URL and the design intent
      // note in fill-assist.component.ts buildRequestData.
      fixture.componentRef.setInput("policy", new FillAssistPolicy());

      const request = await component.buildRequest();

      expect(request.policy.data?.rulesUrl).toBe(DEFAULT_URL);
    });

    it("submits DEFAULT_FILL_ASSIST_RULES_URL regardless of any URL value in the form", async () => {
      // If the admin typed a URL under Custom, then switched to Default and
      // saved, we submit the default sentinel (not the stale URL). The form
      // preserves the URL locally for within-session UX, but doesn't leak
      // it into the request.
      fixture.componentRef.setInput("policy", new FillAssistPolicy());
      component.data?.patchValue({ ruleSource: RuleSource.Custom });
      component.data?.patchValue({ rulesUrl: "example.com/rules" });
      component.data?.patchValue({ ruleSource: RuleSource.Default });

      const request = await component.buildRequest();

      expect(request.policy.data?.rulesUrl).toBe(DEFAULT_URL);
    });

    it("does not throw when saving an enabled policy without a rulesUrl (Default)", async () => {
      fixture.componentRef.setInput("policy", new FillAssistPolicy());
      component.enabled.setValue(true);

      await expect(component.buildRequest()).resolves.toBeDefined();
    });
  });

  describe("buildRequest — Custom source", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("policy", new FillAssistPolicy());
      component.data?.patchValue({ ruleSource: RuleSource.Custom });
    });

    it("prepends https:// when building the save request", async () => {
      component.data?.patchValue({ rulesUrl: "acme.example.com/rules" });

      const request = await component.buildRequest();

      expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
    });

    it("does not double-prefix https:// when the form value already has it", async () => {
      // Enter-key submission skips the blur handler, so a pasted `https://…`
      // can still be in the raw form value at save time. buildRequestData must
      // be idempotent — strip any existing prefix before prepending.
      component.data?.patchValue({ rulesUrl: "https://acme.example.com/rules" });

      const request = await component.buildRequest();

      expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
    });

    it("trims surrounding whitespace before saving", async () => {
      // `new URL()` tolerates surrounding whitespace, so this string passes the
      // validator; without trimming it silently 404s downstream.
      component.data?.patchValue({ rulesUrl: "  acme.example.com/rules  " });

      const request = await component.buildRequest();

      expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
    });

    it.each([["acme.example.com/rules/"], ["acme.example.com/rules//"]])(
      "strips trailing slash(es) before saving: %s",
      async (input) => {
        // Stored value must be canonical; downstream URL composition adds its own
        // separator when joining with the manifest filename.
        component.data?.patchValue({ rulesUrl: input });

        const request = await component.buildRequest();

        expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
      },
    );

    it("throws when saving an enabled policy without a rulesUrl", async () => {
      component.enabled.setValue(true);
      component.data?.patchValue({ rulesUrl: "" });

      await expect(component.buildRequest()).rejects.toThrow("invalidFillAssistRulesUrlV2");
    });

    it("does not throw when saving a disabled policy without a rulesUrl", async () => {
      // URL is only meaningful when the policy is on. An admin who saves with
      // the policy off should not be blocked by a missing URL.
      component.enabled.setValue(false);
      component.data?.patchValue({ rulesUrl: "" });

      await expect(component.buildRequest()).resolves.toBeDefined();
    });
  });

  describe("template-attached required validator", () => {
    // These tests must call `fixture.detectChanges()` — without it the `@if` never
    // mounts the input and the template's `RequiredValidator` never attaches.

    it("does not block Save when the policy is disabled and the admin clears a stored custom URL", () => {
      // Regression: a bare `required` attribute attached RequiredValidator
      // unconditionally, invalidating a disabled policy with an emptied URL.
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(false, { rulesUrl: CUSTOM_URL }),
      );
      fixture.detectChanges();

      component.data?.patchValue({ rulesUrl: "" });

      expect(component.data?.valid).toBe(true);
      expect(component.data?.get("rulesUrl")?.errors).toBeNull();
    });

    it("surfaces the custom URL error first when the policy is enabled and the URL is empty", () => {
      // Both the custom validator and Angular's RequiredValidator fire on empty;
      // the errors object contains `url` and `required`. `bit-form-field` reads
      // `Object.keys(errors)[0]` to decide what to render, so the ORDER matters:
      // our validator must be composed first so its custom message wins over the
      // framework's default "Input is required" text.
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(true, { rulesUrl: CUSTOM_URL }),
      );
      fixture.detectChanges();

      component.data?.patchValue({ rulesUrl: "" });

      const errors = component.data?.get("rulesUrl")?.errors ?? {};
      expect(component.data?.invalid).toBe(true);
      expect(Object.keys(errors)[0]).toBe("url");
      expect(errors["url"]).toEqual({ message: "invalidFillAssistRulesUrlV2" });
    });
  });

  describe("isCloud$", () => {
    it("emits true for cloud environments", async () => {
      // Default in beforeEach is cloud
      const isCloud = await firstValueFrom((component as any).isCloud$);

      expect(isCloud).toBe(true);
    });

    it("emits false for self-hosted environments", async () => {
      environmentSubject.next(makeEnvironment(false));

      const isCloud = await firstValueFrom((component as any).isCloud$);

      expect(isCloud).toBe(false);
    });
  });
});
