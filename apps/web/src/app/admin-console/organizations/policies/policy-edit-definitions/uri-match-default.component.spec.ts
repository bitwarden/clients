import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  UriMatchDefaultPolicy,
  UriMatchDefaultPolicyComponent,
  UriMatchDefaultPolicyV2Component,
} from "./uri-match-default.component";

const ORG_ID = "org1" as OrganizationId;
const USER_ID = "user1" as UserId;

function makePolicyResponse(enabled: boolean, data: object | null = null) {
  return new PolicyStatusResponse({
    OrganizationId: ORG_ID,
    Type: PolicyType.UriMatchDefaults,
    Enabled: enabled,
    Data: data,
  });
}

describe("UriMatchDefaultPolicy", () => {
  it("has correct attributes", () => {
    const policy = new UriMatchDefaultPolicy();

    expect(policy.name).toBe("uriMatchDetectionPolicy");
    expect(policy.description).toBe("uriMatchDetectionPolicyDesc");
    expect(policy.type).toBe(PolicyType.UriMatchDefaults);
    expect(policy.component).toBe(UriMatchDefaultPolicyComponent);
  });

  it("renders the v2 component inside the drawer, with its own description and prerequisite", () => {
    const policy = new UriMatchDefaultPolicy();

    expect(policy.v2?.component).toBe(UriMatchDefaultPolicyV2Component);
    expect(policy.v2?.component).not.toBe(policy.component);
    expect(policy.v2?.description).toBe("uriMatchDetectionPolicyDescV2");
    expect(policy.v2?.prerequisiteKey).toBe("requireSsoPolicyReqV2");
  });
});

describe.each`
  description                           | componentClass
  ${"UriMatchDefaultPolicyComponent"}   | ${UriMatchDefaultPolicyComponent}
  ${"UriMatchDefaultPolicyV2Component"} | ${UriMatchDefaultPolicyV2Component}
`("$description", ({ componentClass }) => {
  let component: UriMatchDefaultPolicyComponent;
  let fixture: ComponentFixture<UriMatchDefaultPolicyComponent>;
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

    fixture = TestBed.createComponent(componentClass);
    component = fixture.componentInstance;
  });

  it("defaults uriMatchDetection to Domain", () => {
    expect(component.data?.value?.uriMatchDetection).toBe(UriMatchStrategy.Domain);
  });

  it("builds the four uri match options", () => {
    expect(component.uriMatchOptions.map((o) => o.value)).toEqual([
      UriMatchStrategy.Domain,
      UriMatchStrategy.Host,
      UriMatchStrategy.Exact,
      UriMatchStrategy.Never,
    ]);
  });

  it("loads uriMatchDetection from policy data on init", () => {
    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse(true, { uriMatchDetection: UriMatchStrategy.Host }),
    );

    component.ngOnInit();

    expect(component.data?.value?.uriMatchDetection).toBe(UriMatchStrategy.Host);
  });

  it("builds request data from the uriMatchDetection control", () => {
    component.data?.patchValue({ uriMatchDetection: UriMatchStrategy.Exact });

    expect(component["buildRequestData"]()).toEqual({
      uriMatchDetection: UriMatchStrategy.Exact,
    });
  });

  it("throws when saving without a selected uriMatchDetection value", async () => {
    component.data?.patchValue({ uriMatchDetection: null });

    await expect(component.buildRequest()).rejects.toThrow();
  });
});
