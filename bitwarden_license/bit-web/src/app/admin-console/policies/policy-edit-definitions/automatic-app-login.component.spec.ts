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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  AutomaticAppLoginPolicyComponent,
  AutomaticAppLoginPolicyV2Component,
} from "./automatic-app-login.component";

const ORG_ID = "org1" as OrganizationId;
const USER_ID = "user1" as UserId;

function makePolicyResponse(enabled: boolean, data: object | null = null) {
  return new PolicyStatusResponse({
    OrganizationId: ORG_ID,
    Type: PolicyType.AutomaticAppLogIn,
    Enabled: enabled,
    Data: data,
  });
}

describe.each`
  description                             | componentClass
  ${"AutomaticAppLoginPolicyComponent"}   | ${AutomaticAppLoginPolicyComponent}
  ${"AutomaticAppLoginPolicyV2Component"} | ${AutomaticAppLoginPolicyV2Component}
`("$description", ({ componentClass }) => {
  let component: AutomaticAppLoginPolicyComponent;
  let fixture: ComponentFixture<AutomaticAppLoginPolicyComponent>;
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
        { provide: I18nService, useValue: { t: jest.fn().mockReturnValue("") } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(componentClass);
    component = fixture.componentInstance;
  });

  it("loads idpHost from policy data on init", () => {
    fixture.componentRef.setInput(
      "policyResponse",
      makePolicyResponse(true, { idpHost: "https://idp.example.com" }),
    );

    component.ngOnInit();

    expect(component.data.controls.idpHost.value).toBe("https://idp.example.com");
  });

  it("builds request data from the idpHost control", () => {
    component.data.controls.idpHost.setValue("https://idp.example.com");

    expect(component["buildRequestData"]()).toEqual({ idpHost: "https://idp.example.com" });
  });
});
