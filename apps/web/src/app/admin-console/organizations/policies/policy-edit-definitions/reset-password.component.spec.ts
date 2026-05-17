import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { ResetPasswordPolicy, ResetPasswordPolicyComponent } from "./reset-password.component";

const ORG_ID = "org1" as OrganizationId;
const USER_ID = "user1" as UserId;

function makePolicyResponse(enabled: boolean, data: object | null = null) {
  return new PolicyStatusResponse({
    OrganizationId: ORG_ID,
    Type: PolicyType.ResetPassword,
    Enabled: enabled,
    Data: data,
  });
}

describe("ResetPasswordPolicy", () => {
  it("has correct attributes", () => {
    const policy = new ResetPasswordPolicy();

    expect(policy.name).toBe("accountRecoveryPolicy");
    expect(policy.type).toBe(PolicyType.ResetPassword);
    expect(policy.component).toBe(ResetPasswordPolicyComponent);
  });
});

describe("ResetPasswordPolicyComponent", () => {
  let component: ResetPasswordPolicyComponent;
  let fixture: ComponentFixture<ResetPasswordPolicyComponent>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockAccountService: MockProxy<AccountService>;
  let mockConfigService: MockProxy<ConfigService>;

  beforeEach(async () => {
    mockOrganizationService = mock<OrganizationService>();
    mockAccountService = mock<AccountService>();
    mockConfigService = mock<ConfigService>();

    mockAccountService.activeAccount$ = of({ id: USER_ID } as any);
    mockOrganizationService.organizations$.mockReturnValue(
      of([{ id: ORG_ID, keyConnectorEnabled: false } as Organization]),
    );
    mockConfigService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: PolicyApiServiceAbstraction, useValue: mock<PolicyApiServiceAbstraction>() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordPolicyComponent);
    component = fixture.componentInstance;
  });

  describe("autoEnrollEnabled initial state", () => {
    it("is disabled when the policy is initially disabled", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false));

      await component.ngOnInit();

      expect(component.data.controls.autoEnrollEnabled.disabled).toBe(true);
    });

    it("is enabled when the policy is initially enabled", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(true));

      await component.ngOnInit();

      expect(component.data.controls.autoEnrollEnabled.enabled).toBe(true);
    });
  });

  describe("autoEnrollEnabled reactive behavior", () => {
    it("becomes disabled and unchecked when 'Turn On' is unchecked", async () => {
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(true, { autoEnrollEnabled: true }),
      );
      await component.ngOnInit();

      component.enabled.setValue(false);

      expect(component.data.controls.autoEnrollEnabled.disabled).toBe(true);
      expect(component.data.controls.autoEnrollEnabled.value).toBe(false);
    });

    it("becomes enabled when 'Turn On' is checked", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false));
      await component.ngOnInit();

      component.enabled.setValue(true);

      expect(component.data.controls.autoEnrollEnabled.enabled).toBe(true);
    });
  });

  describe("buildRequestData", () => {
    it("includes autoEnrollEnabled: false in the payload even when the control is disabled", async () => {
      fixture.componentRef.setInput("policyResponse", makePolicyResponse(false));
      await component.ngOnInit();

      const result = component["buildRequestData"]();

      expect(result.autoEnrollEnabled).toBe(false);
    });

    it("includes autoEnrollEnabled: true in the payload when enabled and checked", async () => {
      fixture.componentRef.setInput(
        "policyResponse",
        makePolicyResponse(true, { autoEnrollEnabled: true }),
      );
      await component.ngOnInit();

      const result = component["buildRequestData"]();

      expect(result.autoEnrollEnabled).toBe(true);
    });
  });
});
