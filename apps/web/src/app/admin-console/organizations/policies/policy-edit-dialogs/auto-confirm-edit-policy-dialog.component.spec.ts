import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  AutoConfirmPolicyDialogComponent,
  AutoConfirmPolicyDialogData,
} from "./auto-confirm-edit-policy-dialog.component";

describe("AutoConfirmPolicyDialogComponent", () => {
  let component: AutoConfirmPolicyDialogComponent;
  let fixture: ComponentFixture<AutoConfirmPolicyDialogComponent>;

  let mockPolicyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let mockAccountService: FakeAccountService;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockPolicyService: MockProxy<PolicyService>;
  let mockRouter: MockProxy<Router>;
  let mockAutoConfirmService: MockProxy<AutomaticUserConfirmationService>;
  let mockDialogRef: MockProxy<DialogRef>;
  let mockToastService: MockProxy<ToastService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockKeyService: MockProxy<KeyService>;

  const mockUserId = newGuid() as UserId;
  const mockOrgId = newGuid() as OrganizationId;

  const mockDialogData: AutoConfirmPolicyDialogData = {
    organizationId: mockOrgId,
    policy: {
      name: "automaticUserConfirmation",
      description: "Auto Confirm Policy",
      type: PolicyType.AutoConfirm,
      component: {} as any,
      showDescription: true,
      display$: () => of(true),
    },
    firstTimeDialog: false,
  };

  const mockOrg = {
    id: mockOrgId,
    name: "Test Organization",
    enabled: true,
    isAdmin: true,
    canManagePolicies: true,
  } as Organization;

  beforeEach(async () => {
    mockPolicyApiService = mock<PolicyApiServiceAbstraction>();
    mockAccountService = mockAccountServiceWith(mockUserId);
    mockOrganizationService = mock<OrganizationService>();
    mockPolicyService = mock<PolicyService>();
    mockRouter = mock<Router>();
    mockAutoConfirmService = mock<AutomaticUserConfirmationService>();
    mockDialogRef = mock<DialogRef>();
    mockToastService = mock<ToastService>();
    mockI18nService = mock<I18nService>();
    mockKeyService = mock<KeyService>();

    mockPolicyService.policies$.mockReturnValue(of([]));
    mockOrganizationService.organizations$.mockReturnValue(of([mockOrg]));

    await TestBed.configureTestingModule({
      imports: [AutoConfirmPolicyDialogComponent],
      providers: [
        FormBuilder,
        { provide: DIALOG_DATA, useValue: mockDialogData },
        { provide: AccountService, useValue: mockAccountService },
        { provide: PolicyApiServiceAbstraction, useValue: mockPolicyApiService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: ToastService, useValue: mockToastService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: Router, useValue: mockRouter },
        { provide: AutomaticUserConfirmationService, useValue: mockAutoConfirmService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(AutoConfirmPolicyDialogComponent, {
        set: { template: "<div></div>" },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AutoConfirmPolicyDialogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("handleSubmit", () => {
    beforeEach(() => {
      // Mock the policyComponent
      component.policyComponent = {
        buildRequest: jest.fn().mockResolvedValue({ enabled: true, data: null }),
        enabled: { value: true },
        setSingleOrgEnabled: jest.fn(),
      } as any;

      mockAutoConfirmService.configuration$.mockReturnValue(
        of({ enabled: false, showSetupDialog: true, showBrowserNotification: undefined }),
      );
      mockAutoConfirmService.upsert.mockResolvedValue(undefined);
      mockI18nService.t.mockReturnValue("Policy updated");
    });

    it("should enable SingleOrg policy when it was not already enabled", async () => {
      mockPolicyApiService.putPolicyVNext.mockResolvedValue({} as any);

      // Call handleSubmit with singleOrgEnabled = false (meaning it needs to be enabled)
      await component["handleSubmit"](false);

      // First call should be SingleOrg enable
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenNthCalledWith(
        1,
        mockOrgId,
        PolicyType.SingleOrg,
        { policy: { enabled: true, data: null } },
      );
    });

    it("should not enable SingleOrg policy when it was already enabled", async () => {
      mockPolicyApiService.putPolicyVNext.mockResolvedValue({} as any);

      // Call handleSubmit with singleOrgEnabled = true (meaning it's already enabled)
      await component["handleSubmit"](true);

      // Should only call putPolicyVNext once (for AutoConfirm, not SingleOrg)
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledTimes(1);
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledWith(
        mockOrgId,
        PolicyType.AutoConfirm,
        { policy: { enabled: true, data: null } },
      );
    });

    it("should rollback SingleOrg policy when AutoConfirm fails and SingleOrg was enabled during action", async () => {
      const autoConfirmError = new Error("AutoConfirm failed");

      // First call (SingleOrg enable) succeeds, second call (AutoConfirm) fails, third call (SingleOrg rollback) succeeds
      mockPolicyApiService.putPolicyVNext
        .mockResolvedValueOnce({} as any) // SingleOrg enable
        .mockRejectedValueOnce(autoConfirmError) // AutoConfirm fails
        .mockResolvedValueOnce({} as any); // SingleOrg rollback

      await expect(component["handleSubmit"](false)).rejects.toThrow("AutoConfirm failed");

      // Verify: SingleOrg enabled, AutoConfirm attempted, SingleOrg rolled back
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledTimes(3);
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenNthCalledWith(
        1,
        mockOrgId,
        PolicyType.SingleOrg,
        { policy: { enabled: true, data: null } },
      );
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenNthCalledWith(
        2,
        mockOrgId,
        PolicyType.AutoConfirm,
        { policy: { enabled: true, data: null } },
      );
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenNthCalledWith(
        3,
        mockOrgId,
        PolicyType.SingleOrg,
        { policy: { enabled: false, data: null } },
      );
    });

    it("should not rollback SingleOrg policy when AutoConfirm fails but SingleOrg was already enabled", async () => {
      const autoConfirmError = new Error("AutoConfirm failed");

      // AutoConfirm call fails (SingleOrg was already enabled, so no SingleOrg calls)
      mockPolicyApiService.putPolicyVNext.mockRejectedValue(autoConfirmError);

      await expect(component["handleSubmit"](true)).rejects.toThrow("AutoConfirm failed");

      // Verify only AutoConfirm was called (no SingleOrg enable/rollback)
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledTimes(1);
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledWith(
        mockOrgId,
        PolicyType.AutoConfirm,
        { policy: { enabled: true, data: null } },
      );
    });

    it("should keep both policies enabled when both submissions succeed", async () => {
      mockPolicyApiService.putPolicyVNext.mockResolvedValue({} as any);

      await component["handleSubmit"](false);

      // Verify two calls: SingleOrg enable and AutoConfirm enable
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledTimes(2);
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenNthCalledWith(
        1,
        mockOrgId,
        PolicyType.SingleOrg,
        { policy: { enabled: true, data: null } },
      );
      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenNthCalledWith(
        2,
        mockOrgId,
        PolicyType.AutoConfirm,
        { policy: { enabled: true, data: null } },
      );
    });

    it("should re-throw the error after rollback", async () => {
      const autoConfirmError = new Error("Network error");

      mockPolicyApiService.putPolicyVNext
        .mockResolvedValueOnce({} as any) // SingleOrg enable
        .mockRejectedValueOnce(autoConfirmError) // AutoConfirm fails
        .mockResolvedValueOnce({} as any); // SingleOrg rollback

      await expect(component["handleSubmit"](false)).rejects.toThrow("Network error");
    });
  });

  describe("setSingleOrgPolicy", () => {
    it("should call putPolicyVNext with enabled: true when enabling", async () => {
      mockPolicyApiService.putPolicyVNext.mockResolvedValue({} as any);

      await component["setSingleOrgPolicy"](true);

      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledWith(
        mockOrgId,
        PolicyType.SingleOrg,
        { policy: { enabled: true, data: null } },
      );
    });

    it("should call putPolicyVNext with enabled: false when disabling", async () => {
      mockPolicyApiService.putPolicyVNext.mockResolvedValue({} as any);

      await component["setSingleOrgPolicy"](false);

      expect(mockPolicyApiService.putPolicyVNext).toHaveBeenCalledWith(
        mockOrgId,
        PolicyType.SingleOrg,
        { policy: { enabled: false, data: null } },
      );
    });
  });
});
