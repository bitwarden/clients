import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

class StubPolicy extends BasePolicyEditDefinition {
  name = "stubPolicy";
  description = "stubPolicyDesc";
  type = PolicyType.TwoFactorAuthentication;
  category = PolicyCategory.Authentication;
  priority = 0;
  component = SimpleTogglePolicyComponent;
}

function makePolicyResponse(enabled: boolean) {
  return new PolicyStatusResponse({
    organizationId: "org1",
    type: PolicyType.TwoFactorAuthentication,
    enabled,
  });
}

describe("SimpleTogglePolicyComponent", () => {
  let component: SimpleTogglePolicyComponent;
  let fixture: ComponentFixture<SimpleTogglePolicyComponent>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SimpleTogglePolicyComponent);
    component = fixture.componentInstance;
  });

  describe("buildRequest", () => {
    it("should return enabled: true when the toggle is on", async () => {
      const policy = new StubPolicy();
      fixture.componentRef.setInput("policy", policy);
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
      component.ngOnInit();

      const result = await component.buildRequest(mock<OrgKey>());

      expect(result).toEqual({
        policy: { enabled: true, data: null },
        metadata: null,
      });
    });

    it("should return enabled: false when the toggle is off", async () => {
      const policy = new StubPolicy();
      fixture.componentRef.setInput("policy", policy);
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false));
      component.ngOnInit();

      const result = await component.buildRequest(mock<OrgKey>());

      expect(result).toEqual({
        policy: { enabled: false, data: null },
        metadata: null,
      });
    });

    it("should return enabled: true when policy is disabled and then re-enabled via the form", async () => {
      const policy = new StubPolicy();
      fixture.componentRef.setInput("policy", policy);
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false));
      component.ngOnInit();

      component.enabled.setValue(true);

      const result = await component.buildRequest(mock<OrgKey>());

      expect(result.policy.enabled).toBe(true);
    });
  });
});
