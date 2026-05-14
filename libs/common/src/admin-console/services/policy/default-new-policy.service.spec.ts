import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { newGuid } from "@bitwarden/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { FakeSingleUserState } from "../../../../spec/fake-state";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
  PolicyType,
} from "../../../admin-console/enums";
import { PermissionsApi } from "../../../admin-console/models/api/permissions.api";
import { OrganizationData } from "../../../admin-console/models/data/organization.data";
import { PolicyData } from "../../../admin-console/models/data/policy.data";
import { Organization } from "../../../admin-console/models/domain/organization";
import { MockSdkService } from "../../../platform/spec/mock-sdk.service";
import { PolicyId, UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";

import { DefaultNewPolicyService } from "./default-new-policy.service";
import { POLICIES_NEW } from "./policy-state";

describe("DefaultNewPolicyService", () => {
  const userId = newGuid() as UserId;
  let stateProvider: FakeStateProvider;
  let singleUserState: FakeSingleUserState<Record<PolicyId, PolicyData>>;
  const accountService = mockAccountServiceWith(userId);

  let organizationService: MockProxy<OrganizationService>;
  let sdkService: MockSdkService;

  let service: DefaultNewPolicyService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(accountService);
    singleUserState = stateProvider.singleUser.getFake(userId, POLICIES_NEW);
    organizationService = mock();
    sdkService = new MockSdkService();

    organizationService.organizations$.calledWith(userId).mockReturnValue(of([]));
    organizationService.acceptedOrganizations$.calledWith(userId).mockReturnValue(of([]));

    service = new DefaultNewPolicyService(stateProvider, () => sdkService, organizationService);
  });

  it("upsert adds a policy to the existing state", async () => {
    singleUserState.nextState(
      arrayToRecord([policyData("1", "org1", PolicyType.MaximumVaultTimeout, true)]),
    );

    await service.upsert(policyData("2", "org1", PolicyType.DisableSend, true), userId);

    const result = await firstValueFrom(singleUserState.state$);
    expect(Object.keys(result!)).toHaveLength(2);
    expect(result!["2" as PolicyId].id).toBe("2");
  });

  it("replace overwrites all existing state with the provided policies", async () => {
    singleUserState.nextState(
      arrayToRecord([policyData("1", "org1", PolicyType.MaximumVaultTimeout, true)]),
    );

    await service.replace({ "2": policyData("2", "org1", PolicyType.DisableSend, true) }, userId);

    const result = await firstValueFrom(singleUserState.state$);
    expect(Object.keys(result!)).toHaveLength(1);
    expect(result!["2" as PolicyId].id).toBe("2");
  });

  describe("policiesByType$", () => {
    const policyId1 = newGuid();
    const policyId2 = newGuid();
    const orgId1 = newGuid();
    const orgId2 = newGuid();

    it("delegates filtering to the SDK and maps the result back to Policy", async () => {
      const policies = [
        policyData(policyId1, orgId1, PolicyType.MaximumVaultTimeout, true, { minutes: 30 }),
        policyData(policyId2, orgId1, PolicyType.DisableSend, true),
      ];
      singleUserState.nextState(arrayToRecord(policies));

      const confirmed = [organization(orgId1, OrganizationUserStatusType.Confirmed)];
      const accepted = [organization(orgId2, OrganizationUserStatusType.Accepted)];
      organizationService.organizations$.calledWith(userId).mockReturnValue(of(confirmed));
      organizationService.acceptedOrganizations$.calledWith(userId).mockReturnValue(of(accepted));

      const filterByType = jest.fn().mockReturnValue([
        {
          id: policyId1,
          organization_id: orgId1,
          type: PolicyType.MaximumVaultTimeout as number,
          data: JSON.stringify({ minutes: 30 }),
          enabled: true,
        },
      ]);
      sdkService.client.policies.mockReturnValue({ filter_by_type: filterByType } as any);

      const result = await firstValueFrom(
        service.policiesByType$(PolicyType.MaximumVaultTimeout, userId),
      );

      expect(filterByType).toHaveBeenCalledTimes(1);
      const [sdkPolicies, sdkOrgs, type] = filterByType.mock.calls[0];
      expect(sdkPolicies).toHaveLength(2);
      expect(sdkPolicies.map((p: any) => p.id)).toEqual([policyId1, policyId2]);
      expect(sdkOrgs.map((o: any) => o.id)).toEqual([orgId1, orgId2]);
      expect(type).toBe(PolicyType.MaximumVaultTimeout);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: policyId1,
        organizationId: orgId1,
        type: PolicyType.MaximumVaultTimeout,
        data: { minutes: 30 },
        enabled: true,
      });
    });

    it("passes undefined to the SDK when a policy has no data", async () => {
      singleUserState.nextState(
        arrayToRecord([policyData(policyId1, orgId1, PolicyType.DisableSend, true, null)]),
      );
      organizationService.organizations$
        .calledWith(userId)
        .mockReturnValue(of([organization(orgId1, OrganizationUserStatusType.Confirmed)]));

      const filterByType = jest.fn().mockReturnValue([]);
      sdkService.client.policies.mockReturnValue({ filter_by_type: filterByType } as any);

      await firstValueFrom(service.policiesByType$(PolicyType.DisableSend, userId));

      const [sdkPolicies] = filterByType.mock.calls[0];
      expect(sdkPolicies[0].data).toBeUndefined();
    });

    it("maps an SDK PolicyView with no data back to a Policy with null data", async () => {
      singleUserState.nextState(
        arrayToRecord([policyData(policyId1, orgId1, PolicyType.DisableSend, true)]),
      );
      organizationService.organizations$
        .calledWith(userId)
        .mockReturnValue(of([organization(orgId1, OrganizationUserStatusType.Confirmed)]));

      sdkService.client.policies.mockReturnValue({
        filter_by_type: jest.fn().mockReturnValue([
          {
            id: policyId1,
            organization_id: orgId1,
            type: PolicyType.DisableSend as number,
            data: undefined,
            enabled: true,
          },
        ]),
      } as any);

      const result = await firstValueFrom(service.policiesByType$(PolicyType.DisableSend, userId));

      expect(result).toHaveLength(1);
      expect(result[0].data).toBeNull();
    });
  });

  function policyData(
    id: string,
    organizationId: string,
    type: PolicyType,
    enabled: boolean,
    data?: any,
  ): PolicyData {
    const pd = new PolicyData({} as any);
    pd.id = id as PolicyId;
    pd.organizationId = organizationId;
    pd.type = type;
    pd.enabled = enabled;
    pd.data = data;
    pd.revisionDate = new Date().toISOString();
    return pd;
  }

  function organization(id: string, status: OrganizationUserStatusType): Organization {
    const data = new OrganizationData({} as any, {} as any);
    data.id = id;
    data.enabled = true;
    data.usePolicies = true;
    data.status = status;
    data.permissions = new PermissionsApi({} as any);
    data.type = OrganizationUserType.User;
    return new Organization(data);
  }

  function arrayToRecord(input: PolicyData[]): Record<PolicyId, PolicyData> {
    return Object.fromEntries(input.map((i) => [i.id, i]));
  }
});
