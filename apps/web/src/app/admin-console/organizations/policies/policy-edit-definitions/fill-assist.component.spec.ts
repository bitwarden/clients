import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { FillAssistPolicy, FillAssistPolicyComponent } from "./fill-assist.component";

const ORG_ID = "org1" as OrganizationId;
const USER_ID = "user1" as UserId;
const DEFAULT_URL = "https://github.com/bitwarden/map-the-web/releases/latest/download";

function makePolicyResponse(enabled: boolean, data: object | null = null) {
  return new PolicyStatusResponse({
    OrganizationId: ORG_ID,
    // TODO(PM-41310): Replace with `PolicyType.FillAssist` once the SDK bump (PR 3) lands.
    Type: 22,
    Enabled: enabled,
    Data: data,
  });
}

describe("FillAssistPolicy", () => {
  it("has correct attributes", () => {
    const policy = new FillAssistPolicy();

    expect(policy.name).toBe("fillAssistPolicy");
    expect(policy.description).toBe("fillAssistPolicyDesc");
    // TODO(PM-41310): Replace with `PolicyType.FillAssist` once the SDK bump (PR 3) lands.
    expect(policy.type).toBe(22);
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
});

describe("FillAssistPolicyComponent", () => {
  let component: FillAssistPolicyComponent;
  let fixture: ComponentFixture<FillAssistPolicyComponent>;
  let accountService: FakeAccountService;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(USER_ID);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
        { provide: AccountService, useValue: accountService },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(FillAssistPolicyComponent);
    component = fixture.componentInstance;
  });

  it("defaults rulesUrl to the Bitwarden default", () => {
    expect(component.data?.value?.rulesUrl).toBe(DEFAULT_URL);
  });

  it("loads rulesUrl from policy data on init", () => {
    const customUrl = "https://github.com/acme-org/map-the-web/releases/latest/download";
    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse(true, { rulesUrl: customUrl }),
    );

    component.ngOnInit();

    expect(component.data?.value?.rulesUrl).toBe(customUrl);
  });

  it("keeps the default rulesUrl when policy data is null", () => {
    fixture.componentRef.setInput("policyResponse", makePolicyResponse(false, null));

    component.ngOnInit();

    expect(component.data?.value?.rulesUrl).toBe(DEFAULT_URL);
  });

  it("marks the form invalid when rulesUrl is empty", () => {
    component.data?.patchValue({ rulesUrl: "" });

    expect(component.data?.invalid).toBe(true);
  });

  it("marks the form invalid when rulesUrl is not a valid URL", () => {
    component.data?.patchValue({ rulesUrl: "not a url" });

    expect(component.data?.invalid).toBe(true);
  });

  it("accepts a valid https URL", () => {
    component.data?.patchValue({ rulesUrl: "https://example.com/rules" });

    expect(component.data?.valid).toBe(true);
  });

  it.each([
    ["http://example.com/rules"],
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
    ["ftp://example.com/rules"],
  ])("rejects non-https URL scheme: %s", (url) => {
    component.data?.patchValue({ rulesUrl: url });

    expect(component.data?.invalid).toBe(true);
    expect(component.data?.get("rulesUrl")?.errors).toEqual({
      url: { message: "invalidFillAssistRulesUrl" },
    });
  });

  it("throws when saving without a rulesUrl", async () => {
    fixture.componentRef.setInput("policy", new FillAssistPolicy());
    component.data?.patchValue({ rulesUrl: "" });

    await expect(component.buildRequest()).rejects.toThrow("invalidFillAssistRulesUrl");
  });
});
