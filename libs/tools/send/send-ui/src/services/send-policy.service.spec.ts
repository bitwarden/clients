import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { UserId } from "@bitwarden/common/types/guid";

import { SendPolicyService } from "..";

const userId = "test-user-id" as UserId;

function makePolicy(data: Record<string, unknown> | null): Policy {
  const p = new Policy();
  p.data = data;
  p.enabled = true;
  return p;
}

describe("SendPolicyService", () => {
  let service: SendPolicyService;

  const policyServiceMock = mock<PolicyService>();
  const configServiceMock = mock<ConfigService>();
  const organizationServiceMock = mock<OrganizationService>();

  beforeEach(() => {
    const testBed = TestBed.configureTestingModule({
      providers: [
        { provide: PolicyService, useValue: policyServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: OrganizationService, useValue: organizationServiceMock },
        SendPolicyService,
      ],
    });
    service = testBed.inject(SendPolicyService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("disableSend$", () => {
    it("emits true when SendControls policy has disableSend: true", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy({ disableSend: true })]));
      policyServiceMock.policyAppliesToUser$
        .calledWith(PolicyType.DisableSend, userId)
        .mockReturnValue(of(false));

      expect(await firstValueFrom(service.disableSend$)).toBe(true);
    });

    it("emits false when SendControls policy has disableSend: false and no legacy policy", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy({ disableSend: false })]));
      policyServiceMock.policyAppliesToUser$
        .calledWith(PolicyType.DisableSend, userId)
        .mockReturnValue(of(false));

      expect(await firstValueFrom(service.disableSend$)).toBe(false);
    });

    it("emits false when policy data is null and no legacy policy", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy(null)]));
      policyServiceMock.policyAppliesToUser$
        .calledWith(PolicyType.DisableSend, userId)
        .mockReturnValue(of(false));

      expect(await firstValueFrom(service.disableSend$)).toBe(false);
    });

    it("emits true when legacy DisableSend applies even if SendControls does not", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([]));
      policyServiceMock.policyAppliesToUser$
        .calledWith(PolicyType.DisableSend, userId)
        .mockReturnValue(of(true));

      expect(await firstValueFrom(service.disableSend$)).toBe(true);
    });
  });

  describe("disableHideEmail$", () => {
    it("emits true when SendControls policy has disableHideEmail: true", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy({ disableHideEmail: true })]));
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendOptions, userId)
        .mockReturnValue(of([]));

      expect(await firstValueFrom(service.disableHideEmail$)).toBe(true);
    });

    it("emits false when SendControls policy has disableHideEmail: false and no legacy policy", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy({ disableHideEmail: false })]));
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendOptions, userId)
        .mockReturnValue(of([]));

      expect(await firstValueFrom(service.disableHideEmail$)).toBe(false);
    });

    it("emits false when policy data is null and no legacy policy", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy(null)]));
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendOptions, userId)
        .mockReturnValue(of([]));

      expect(await firstValueFrom(service.disableHideEmail$)).toBe(false);
    });

    it("emits true when legacy SendOptions applies even if SendControls does not", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([]));
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendOptions, userId)
        .mockReturnValue(of([makePolicy({ disableHideEmail: true })]));

      expect(await firstValueFrom(service.disableHideEmail$)).toBe(true);
    });
  });

  describe("allowedSendTypes$", () => {
    it("emits the types restricted by policy", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy({ allowedSendTypes: [SendType.Text] })]));

      expect(await firstValueFrom(service.allowedSendTypes$)).toEqual([SendType.Text]);
    });

    it("defaults to all Send types when no restrict-type policy applies", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([]));

      expect(await firstValueFrom(service.allowedSendTypes$)).toEqual([
        SendType.Text,
        SendType.File,
      ]);
    });

    it("defaults to all Send types when the policy does not specify allowedSendTypes", async () => {
      policyServiceMock.policiesByType$
        .calledWith(PolicyType.SendControls, userId)
        .mockReturnValue(of([makePolicy({})]));

      expect(await firstValueFrom(service.allowedSendTypes$)).toEqual([
        SendType.Text,
        SendType.File,
      ]);
    });
  });
});
