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

import { FillAssistPolicy, FillAssistPolicyComponent } from "./fill-assist.component";

const ORG_ID = "org1" as OrganizationId;
const USER_ID = "user1" as UserId;
const DEFAULT_URL = "https://github.com/bitwarden/map-the-web/releases/latest/download";
// Host+path form of the default, matching what appears in the form input
// (the `https://` is rendered as an uneditable `bitPrefix` in the template).
const DEFAULT_URL_HOST_PATH = "github.com/bitwarden/map-the-web/releases/latest/download";

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

    expect(policy.name).toBe("fillAssistPolicy");
    expect(policy.description).toBe("fillAssistPolicyDesc");
    expect(policy.type).toBe(PolicyType.FillAssist);
    expect(policy.component).toBe(FillAssistPolicyComponent);
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

  it("defaults rulesUrl to the host+path of the Bitwarden default", () => {
    expect(component.data?.value?.rulesUrl).toBe(DEFAULT_URL_HOST_PATH);
  });

  it("strips the https:// prefix when loading rulesUrl from policy data on init", () => {
    // Stored data is a canonical full URL; the form shows just the host+path
    // because the template renders `https://` as an uneditable `bitPrefix`.
    const customUrl = "https://github.com/acme-org/map-the-web/releases/latest/download";
    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse(true, { rulesUrl: customUrl }),
    );

    component.ngOnInit();

    expect(component.data?.value?.rulesUrl).toBe(
      "github.com/acme-org/map-the-web/releases/latest/download",
    );
  });

  it("keeps the default rulesUrl when policy data is null", () => {
    fixture.componentRef.setInput("policyResponse", makePolicyResponse(false, null));

    component.ngOnInit();

    expect(component.data?.value?.rulesUrl).toBe(DEFAULT_URL_HOST_PATH);
  });

  it("keeps the default rulesUrl when policy data has no rulesUrl field", () => {
    // The server returns `{}` (not `null`) for a policy that has never been
    // configured, so the base class DOES call loadData. The override must not
    // clear the form's constructor default when there's nothing to strip.
    fixture.componentRef.setInput("policyResponse", makePolicyResponse(false, {}));

    component.ngOnInit();

    expect(component.data?.value?.rulesUrl).toBe(DEFAULT_URL_HOST_PATH);
  });

  it("marks the form invalid when rulesUrl is empty", () => {
    component.data?.patchValue({ rulesUrl: "" });

    expect(component.data?.invalid).toBe(true);
  });

  it("marks the form invalid when rulesUrl is not a valid URL", () => {
    component.data?.patchValue({ rulesUrl: "not a url" });

    expect(component.data?.invalid).toBe(true);
  });

  it("accepts a valid host+path value", () => {
    component.data?.patchValue({ rulesUrl: "example.com/rules" });

    expect(component.data?.valid).toBe(true);
  });

  describe("rulesUrl enabled state mirrors the policy toggle", () => {
    it("disables the rulesUrl field when the policy is disabled", () => {
      component.enabled.setValue(false);

      expect(component.data?.controls.rulesUrl.disabled).toBe(true);
    });

    it("enables the rulesUrl field when the policy is enabled", () => {
      component.enabled.setValue(true);

      expect(component.data?.controls.rulesUrl.enabled).toBe(true);
    });

    it("preserves the rulesUrl value across disable/enable transitions", () => {
      component.data?.patchValue({ rulesUrl: "example.com/rules" });
      component.enabled.setValue(false);
      component.enabled.setValue(true);

      expect(component.data?.controls.rulesUrl.value).toBe("example.com/rules");
    });
  });

  describe("protocol handling on user input", () => {
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
        url: { message: "invalidFillAssistRulesUrl" },
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

  it("prepends https:// when building the save request", async () => {
    fixture.componentRef.setInput("policy", new FillAssistPolicy());
    component.data?.patchValue({ rulesUrl: "acme.example.com/rules" });

    const request = await component.buildRequest();

    expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
  });

  it("does not double-prefix https:// when the form value already has it", async () => {
    // Enter-key submission skips the blur handler, so a pasted `https://…`
    // can still be in the raw form value at save time. buildRequestData must
    // be idempotent — strip any existing prefix before prepending.
    fixture.componentRef.setInput("policy", new FillAssistPolicy());
    component.data?.patchValue({ rulesUrl: "https://acme.example.com/rules" });

    const request = await component.buildRequest();

    expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
  });

  it("trims surrounding whitespace before saving", async () => {
    // `new URL()` tolerates surrounding whitespace, so this string passes the
    // validator; without trimming it silently 404s downstream.
    fixture.componentRef.setInput("policy", new FillAssistPolicy());
    component.data?.patchValue({ rulesUrl: "  acme.example.com/rules  " });

    const request = await component.buildRequest();

    expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
  });

  it.each([["acme.example.com/rules/"], ["acme.example.com/rules//"]])(
    "strips trailing slash(es) before saving: %s",
    async (input) => {
      // Stored value must be canonical; downstream URL composition adds its own
      // separator when joining with the manifest filename.
      fixture.componentRef.setInput("policy", new FillAssistPolicy());
      component.data?.patchValue({ rulesUrl: input });

      const request = await component.buildRequest();

      expect(request.policy.data?.rulesUrl).toBe("https://acme.example.com/rules");
    },
  );

  it("saves the default URL as a canonical full URL when unchanged", async () => {
    fixture.componentRef.setInput("policy", new FillAssistPolicy());

    const request = await component.buildRequest();

    expect(request.policy.data?.rulesUrl).toBe(DEFAULT_URL);
  });

  it("throws when saving an enabled policy without a rulesUrl", async () => {
    fixture.componentRef.setInput("policy", new FillAssistPolicy());
    component.enabled.setValue(true);
    component.data?.patchValue({ rulesUrl: "" });

    await expect(component.buildRequest()).rejects.toThrow("invalidFillAssistRulesUrl");
  });

  it("does not throw when saving a disabled policy without a rulesUrl", async () => {
    // The URL is meaningful only while the policy is enabled. If the admin
    // clears the URL and then toggles the policy off, the save must succeed —
    // the input is greyed out at that point so there is no way to fix it.
    fixture.componentRef.setInput("policy", new FillAssistPolicy());
    component.enabled.setValue(false);
    component.data?.patchValue({ rulesUrl: "" });

    await expect(component.buildRequest()).resolves.toBeDefined();
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
