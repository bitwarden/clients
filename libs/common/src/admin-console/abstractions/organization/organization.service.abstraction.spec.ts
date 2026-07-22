import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { newGuid } from "@bitwarden/guid";

import { UserId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { Organization } from "../../models/domain/organization";
import { PolicyService } from "../policy/policy.service.abstraction";

import {
  canAccessAccessIntelligence,
  singleOrganizationPolicyApplies$,
} from "./organization.service.abstraction";

describe("singleOrganizationPolicyApplies$", () => {
  const userId = newGuid() as UserId;
  let policyService: MockProxy<PolicyService>;

  beforeEach(() => {
    policyService = mock<PolicyService>();
  });

  it("returns true when SingleOrg applies and AutoConfirm does not", async () => {
    policyService.policyAppliesToUser$.mockImplementation((policyType) => {
      if (policyType === PolicyType.SingleOrg) {
        return of(true);
      }
      return of(false);
    });

    const result = await firstValueFrom(singleOrganizationPolicyApplies$(userId, policyService));

    expect(result).toBe(true);
  });

  it("returns true when AutoConfirm applies and SingleOrg does not", async () => {
    policyService.policyAppliesToUser$.mockImplementation((policyType) => {
      if (policyType === PolicyType.AutomaticUserConfirmation) {
        return of(true);
      }
      return of(false);
    });

    const result = await firstValueFrom(singleOrganizationPolicyApplies$(userId, policyService));

    expect(result).toBe(true);
  });

  it("returns true when both SingleOrg and AutoConfirm apply", async () => {
    policyService.policyAppliesToUser$.mockReturnValue(of(true));

    const result = await firstValueFrom(singleOrganizationPolicyApplies$(userId, policyService));

    expect(result).toBe(true);
  });

  it("returns false when neither SingleOrg nor AutoConfirm applies", async () => {
    policyService.policyAppliesToUser$.mockReturnValue(of(false));

    const result = await firstValueFrom(singleOrganizationPolicyApplies$(userId, policyService));

    expect(result).toBe(false);
  });
});

describe("canAccessAccessIntelligence", () => {
  it("returns true when the org has the ability and the user has report access", () => {
    const org = { canUseAccessIntelligence: true, canAccessReports: true } as Organization;

    expect(canAccessAccessIntelligence(org)).toBe(true);
  });

  it("returns false when the org has the ability but the user lacks report access", () => {
    const org = { canUseAccessIntelligence: true, canAccessReports: false } as Organization;

    expect(canAccessAccessIntelligence(org)).toBe(false);
  });

  it("returns false when the user has report access but the org lacks the ability", () => {
    const org = { canUseAccessIntelligence: false, canAccessReports: true } as Organization;

    expect(canAccessAccessIntelligence(org)).toBe(false);
  });

  it("returns false when neither the ability nor report access is present", () => {
    const org = { canUseAccessIntelligence: false, canAccessReports: false } as Organization;

    expect(canAccessAccessIntelligence(org)).toBe(false);
  });
});
