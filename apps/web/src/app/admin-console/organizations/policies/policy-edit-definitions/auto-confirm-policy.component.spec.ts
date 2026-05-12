import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AutomaticUserConfirmationService, AutoConfirmState } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { AutoConfirmPolicy, AutoConfirmPolicyEditComponent } from "./auto-confirm-policy.component";

describe("AutoConfirmPolicy", () => {
  it("has correct attributes", () => {
    const policy = new AutoConfirmPolicy();

    expect(policy.name).toBe("automaticUserConfirmation");
    expect(policy.description).toBe("autoConfirmDescription");
    expect(policy.type).toBe(PolicyType.AutoConfirm);
    expect(policy.component).toBe(AutoConfirmPolicyEditComponent);
    expect(policy.showDescription).toBe(false);
  });
});

describe("AutoConfirmPolicyEditComponent — policySteps[0].sideEffect", () => {
  let component: AutoConfirmPolicyEditComponent;
  let fixture: ComponentFixture<AutoConfirmPolicyEditComponent>;
  let accountService: FakeAccountService;
  let organizationService: MockProxy<OrganizationService>;
  let policyService: MockProxy<PolicyService>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let autoConfirmService: MockProxy<AutomaticUserConfirmationService>;
  let router: MockProxy<Router>;

  const userId = newGuid() as UserId;
  const orgId = newGuid() as OrganizationId;

  /** Convenience factory for Organization-shaped test objects. */
  function makeOrg(isAdmin: boolean, canManagePolicies: boolean): Organization {
    return { id: orgId, isAdmin, canManagePolicies } as unknown as Organization;
  }

  /** Convenience factory for Policy-shaped test objects. */
  function makePolicy(type: PolicyType, enabled: boolean): Policy {
    return { type, enabled } as Policy;
  }

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    organizationService = mock<OrganizationService>();
    policyService = mock<PolicyService>();
    policyApiService = mock<PolicyApiServiceAbstraction>();
    autoConfirmService = mock<AutomaticUserConfirmationService>();
    router = mock<Router>();

    // Defaults: admin org, no policies, API calls succeed, setup dialog visible
    organizationService.organizations$.mockReturnValue(of([makeOrg(true, false)]));
    policyService.policies$.mockReturnValue(of([]));
    policyApiService.putPolicy.mockResolvedValue(undefined);
    autoConfirmService.configuration$.mockReturnValue(
      of(Object.assign(new AutoConfirmState(), { showSetupDialog: true })),
    );
    autoConfirmService.upsert.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: OrganizationService, useValue: organizationService },
        { provide: PolicyService, useValue: policyService },
        { provide: PolicyApiServiceAbstraction, useValue: policyApiService },
        { provide: AutomaticUserConfirmationService, useValue: autoConfirmService },
        { provide: Router, useValue: router },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AutoConfirmPolicyEditComponent);
    component = fixture.componentInstance;

    // Simulate the inputs that MultiStepPolicyEditDialogComponent provides
    fixture.componentRef.setInput("organizationId", orgId);
    fixture.componentRef.setInput("policy", new AutoConfirmPolicy());
    component.enabled.setValue(true);
    // Intentionally skip detectChanges() — viewChild signals are not needed for sideEffect tests
  });

  async function runSideEffect() {
    return component.policySteps[0].sideEffect!();
  }

  describe("SingleOrg prerequisite enablement", () => {
    it("enables SingleOrg before saving AutoConfirm when SingleOrg is not already enabled", async () => {
      policyService.policies$.mockReturnValue(of([]));

      await runSideEffect();

      expect(policyApiService.putPolicy).toHaveBeenCalledWith(orgId, PolicyType.SingleOrg, {
        policy: { enabled: true, data: null },
        metadata: null,
      });
      expect(policyApiService.putPolicy).toHaveBeenCalledWith(
        orgId,
        PolicyType.AutoConfirm,
        expect.objectContaining({ policy: expect.objectContaining({ enabled: true }) }),
      );
    });

    it("does not enable SingleOrg when it is already enabled", async () => {
      policyService.policies$.mockReturnValue(of([makePolicy(PolicyType.SingleOrg, true)]));

      await runSideEffect();

      const singleOrgEnableCalls = policyApiService.putPolicy.mock.calls.filter(
        ([, type, req]) => type === PolicyType.SingleOrg && req?.policy?.enabled === true,
      );
      expect(singleOrgEnableCalls).toHaveLength(0);
    });

    it("saves AutoConfirm with the enabled value from the form control", async () => {
      component.enabled.setValue(false);

      await runSideEffect();

      expect(policyApiService.putPolicy).toHaveBeenCalledWith(
        orgId,
        PolicyType.AutoConfirm,
        expect.objectContaining({ policy: expect.objectContaining({ enabled: false }) }),
      );
    });
  });

  describe("rollback on AutoConfirm save failure", () => {
    it("rolls back SingleOrg when AutoConfirm save fails and SingleOrg was enabled during this action", async () => {
      policyService.policies$.mockReturnValue(of([])); // SingleOrg not previously enabled

      policyApiService.putPolicy
        .mockResolvedValueOnce(undefined) // SingleOrg enable → success
        .mockRejectedValueOnce(new Error("network error")) // AutoConfirm save → fail
        .mockResolvedValueOnce(undefined); // SingleOrg rollback → success

      await expect(runSideEffect()).rejects.toThrow("network error");

      expect(policyApiService.putPolicy).toHaveBeenCalledWith(orgId, PolicyType.SingleOrg, {
        policy: { enabled: false, data: null },
        metadata: null,
      });
    });

    it("does not roll back SingleOrg when AutoConfirm save fails but SingleOrg was already enabled", async () => {
      policyService.policies$.mockReturnValue(
        of([makePolicy(PolicyType.SingleOrg, true)]), // SingleOrg already on
      );
      policyApiService.putPolicy.mockRejectedValueOnce(new Error("network error"));

      await expect(runSideEffect()).rejects.toThrow("network error");

      const singleOrgDisableCalls = policyApiService.putPolicy.mock.calls.filter(
        ([, type, req]) => type === PolicyType.SingleOrg && req?.policy?.enabled === false,
      );
      expect(singleOrgDisableCalls).toHaveLength(0);
    });
  });

  describe("dialog close behavior", () => {
    it("returns { closeDialog: true } when disabling AutoConfirm (no extension step needed)", async () => {
      component.enabled.setValue(false);

      const result = await runSideEffect();

      expect(result).toEqual({ closeDialog: true });
    });

    it("returns { closeDialog: true } when user has manage-policies permission only (no admin role)", async () => {
      organizationService.organizations$.mockReturnValue(
        of([makeOrg(false, true)]), // not admin, but canManagePolicies
      );
      component.enabled.setValue(true);

      const result = await runSideEffect();

      expect(result).toEqual({ closeDialog: true });
    });

    it("returns undefined to proceed to the extension step when enabling as a full admin", async () => {
      organizationService.organizations$.mockReturnValue(of([makeOrg(true, false)]));
      component.enabled.setValue(true);

      const result = await runSideEffect();

      expect(result).toBeUndefined();
    });
  });

  describe("setup dialog dismissal", () => {
    it("dismisses the first-time setup dialog prompt after a successful save", async () => {
      const currentState = Object.assign(new AutoConfirmState(), { showSetupDialog: true });
      autoConfirmService.configuration$.mockReturnValue(of(currentState));

      await runSideEffect();

      expect(autoConfirmService.upsert).toHaveBeenCalledWith(userId, {
        ...currentState,
        showSetupDialog: false,
      });
    });

    it("preserves the rest of the AutoConfirmState when dismissing the setup dialog", async () => {
      const currentState = Object.assign(new AutoConfirmState(), {
        enabled: true,
        showSetupDialog: true,
        showBrowserNotification: false,
      });
      autoConfirmService.configuration$.mockReturnValue(of(currentState));

      await runSideEffect();

      expect(autoConfirmService.upsert).toHaveBeenCalledWith(userId, {
        enabled: true,
        showSetupDialog: false,
        showBrowserNotification: false,
      });
    });
  });
});
