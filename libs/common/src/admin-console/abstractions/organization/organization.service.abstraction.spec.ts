import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { newGuid } from "@bitwarden/guid";

import { UserId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyService } from "../policy/policy.service.abstraction";

import { singleOrganizationPolicyApplies$ } from "./organization.service.abstraction";

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
      if (policyType === PolicyType.AutoConfirm) {
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
