import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  OrganizationUserNotificationPolicy,
  OrganizationUserNotificationPolicyComponent,
} from "./organization-user-notification-policy.component";

const ORG_ID = "org1" as OrganizationId;
const USER_ID = "user1" as UserId;

function makePolicyResponse(enabled: boolean, data: object | null = null) {
  return new PolicyStatusResponse({
    OrganizationId: ORG_ID,
    Type: PolicyType.OrganizationUserNotification,
    Enabled: enabled,
    Data: data,
  });
}

describe("OrganizationUserNotificationPolicy", () => {
  it("has correct attributes", () => {
    const policy = new OrganizationUserNotificationPolicy();

    expect(policy.name).toBe("organizationUserNotificationPolicyTitle");
    expect(policy.description).toBe("organizationUserNotificationPolicyDesc");
    expect(policy.type).toBe(PolicyType.OrganizationUserNotification);
    expect(policy.component).toBe(OrganizationUserNotificationPolicyComponent);
  });
});

describe("OrganizationUserNotificationPolicyComponent", () => {
  let component: OrganizationUserNotificationPolicyComponent;
  let fixture: ComponentFixture<OrganizationUserNotificationPolicyComponent>;
  let mockPolicyService: MockProxy<PolicyService>;
  let accountService: FakeAccountService;

  function createComponent() {
    fixture = TestBed.createComponent(OrganizationUserNotificationPolicyComponent);
    component = fixture.componentInstance;
  }

  beforeEach(async () => {
    mockPolicyService = mock<PolicyService>();
    accountService = mockAccountServiceWith(USER_ID);

    const mockOrganizationService = mock<OrganizationService>();
    mockPolicyService.policies$.mockReturnValue(of([]));
    mockOrganizationService.organizations$.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: I18nService, useValue: { t: jest.fn().mockReturnValue("") } },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: AccountService, useValue: accountService },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  describe("when SingleOrg policy is not enabled", () => {
    beforeEach(() => {
      mockPolicyService.policies$.mockReturnValue(of([]));
      createComponent();
    });

    it("disables the enabled control", () => {
      expect(component.enabled.disabled).toBe(true);
    });

    it("disables all form controls", () => {
      const { header, description, buttonText, showAfterEveryLogin } = component.data.controls;
      expect(header.disabled).toBe(true);
      expect(description.disabled).toBe(true);
      expect(buttonText.disabled).toBe(true);
      expect(showAfterEveryLogin.disabled).toBe(true);
    });
  });

  describe("when SingleOrg policy is enabled", () => {
    beforeEach(() => {
      mockPolicyService.policies$.mockReturnValue(
        of([{ type: PolicyType.SingleOrg, enabled: true } as Policy]),
      );
      createComponent();
    });

    it("enables the enabled control", () => {
      expect(component.enabled.enabled).toBe(true);
    });

    it("keeps form controls disabled when policy is initially not enabled", () => {
      const { header, description, buttonText, showAfterEveryLogin } = component.data.controls;
      expect(header.disabled).toBe(true);
      expect(description.disabled).toBe(true);
      expect(buttonText.disabled).toBe(true);
      expect(showAfterEveryLogin.disabled).toBe(true);
    });

    it("enables header, description, and showAfterEveryLogin when policy is enabled via ngOnInit", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
      await component.ngOnInit();

      const { header, description, showAfterEveryLogin } = component.data.controls;
      expect(header.enabled).toBe(true);
      expect(description.enabled).toBe(true);
      expect(showAfterEveryLogin.enabled).toBe(true);
    });

    it("enables header, description, and showAfterEveryLogin when enabled is toggled on", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false));
      await component.ngOnInit();

      component.enabled.setValue(true);

      const { header, description, showAfterEveryLogin } = component.data.controls;
      expect(header.enabled).toBe(true);
      expect(description.enabled).toBe(true);
      expect(showAfterEveryLogin.enabled).toBe(true);
    });

    it("disables header, description, and showAfterEveryLogin when enabled is toggled off", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
      await component.ngOnInit();

      component.enabled.setValue(false);

      const { header, description, showAfterEveryLogin } = component.data.controls;
      expect(header.disabled).toBe(true);
      expect(description.disabled).toBe(true);
      expect(showAfterEveryLogin.disabled).toBe(true);
    });

    describe("buttonText conditional behavior", () => {
      it("remains disabled when policy is enabled but header has no value", async () => {
        fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
        await component.ngOnInit();

        expect(component.data.controls.buttonText.disabled).toBe(true);
      });

      it("becomes enabled when header has a non-empty value", async () => {
        fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
        await component.ngOnInit();

        component.data.controls.header.setValue("My Header");

        expect(component.data.controls.buttonText.enabled).toBe(true);
      });

      it("becomes disabled when header is cleared", async () => {
        fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
        await component.ngOnInit();
        component.data.controls.header.setValue("My Header");

        component.data.controls.header.setValue("");

        expect(component.data.controls.buttonText.disabled).toBe(true);
      });

      it("becomes disabled when enabled is toggled off even with a header value", async () => {
        fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
        await component.ngOnInit();
        component.data.controls.header.setValue("My Header");

        component.enabled.setValue(false);

        expect(component.data.controls.buttonText.disabled).toBe(true);
      });
    });
  });

  describe("form validation", () => {
    beforeEach(async () => {
      mockPolicyService.policies$.mockReturnValue(
        of([{ type: PolicyType.SingleOrg, enabled: true } as Policy]),
      );
      createComponent();
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));
      await component.ngOnInit();
    });

    describe("header", () => {
      it("is valid when null", () => {
        component.data.controls.header.setValue(null);

        expect(component.data.controls.header.valid).toBe(true);
      });

      it("is valid with up to 40 characters", () => {
        component.data.controls.header.setValue("a".repeat(40));

        expect(component.data.controls.header.valid).toBe(true);
      });

      it("is invalid with more than 40 characters", () => {
        component.data.controls.header.setValue("a".repeat(41));

        expect(component.data.controls.header.valid).toBe(false);
        expect(component.data.controls.header.errors).toHaveProperty("maxLength");
      });
    });

    describe("description", () => {
      it("is invalid when null", () => {
        component.data.controls.description.setValue(null);

        expect(component.data.controls.description.valid).toBe(false);
        expect(component.data.controls.description.errors).toHaveProperty("requiredCustom");
      });

      it("is invalid when whitespace only", () => {
        component.data.controls.description.setValue("   ");

        expect(component.data.controls.description.valid).toBe(false);
        expect(component.data.controls.description.errors).toHaveProperty("requiredCustom");
      });

      it("is valid with a non-empty value", () => {
        component.data.controls.description.setValue("Valid description");

        expect(component.data.controls.description.valid).toBe(true);
      });

      it("is valid with up to 250 characters", () => {
        component.data.controls.description.setValue("a".repeat(250));

        expect(component.data.controls.description.valid).toBe(true);
      });

      it("is invalid with more than 250 characters", () => {
        component.data.controls.description.setValue("a".repeat(251));

        expect(component.data.controls.description.valid).toBe(false);
        expect(component.data.controls.description.errors).toHaveProperty("maxLength");
      });
    });

    describe("buttonText", () => {
      beforeEach(() => {
        component.data.controls.header.setValue("My Header");
      });

      it("is valid when null", () => {
        component.data.controls.buttonText.setValue(null);

        expect(component.data.controls.buttonText.valid).toBe(true);
      });

      it("is valid with up to 20 characters", () => {
        component.data.controls.buttonText.setValue("a".repeat(20));

        expect(component.data.controls.buttonText.valid).toBe(true);
      });

      it("is invalid with more than 20 characters", () => {
        component.data.controls.buttonText.setValue("a".repeat(21));

        expect(component.data.controls.buttonText.valid).toBe(false);
        expect(component.data.controls.buttonText.errors).toHaveProperty("maxLength");
      });
    });
  });

  describe("buildRequestData", () => {
    beforeEach(() => {
      mockPolicyService.policies$.mockReturnValue(
        of([{ type: PolicyType.SingleOrg, enabled: true } as Policy]),
      );
      createComponent();
    });

    it("returns null when the policy is disabled", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false));
      await component.ngOnInit();

      expect(component["buildRequestData"]()).toBeNull();
    });

    it("returns form data when the policy is enabled", async () => {
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(true, {
          header: "Test Header",
          description: "Test Description",
          buttonText: null,
          showAfterEveryLogin: true,
        }),
      );
      await component.ngOnInit();

      expect(component["buildRequestData"]()).toEqual({
        header: "Test Header",
        description: "Test Description",
        buttonText: null,
        showAfterEveryLogin: true,
      });
    });
  });
});
