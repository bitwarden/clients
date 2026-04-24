import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { newGuid } from "@bitwarden/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { FakeSingleUserState } from "../../../../spec/fake-state";
import { OrganizationUserStatusType, PolicyType } from "../../../admin-console/enums";
import { PermissionsApi } from "../../../admin-console/models/api/permissions.api";
import { OrganizationData } from "../../../admin-console/models/data/organization.data";
import { PolicyData } from "../../../admin-console/models/data/policy.data";
import { Organization } from "../../../admin-console/models/domain/organization";
import { PolicyId, UserId } from "../../../types/guid";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";

import { DefaultNewPolicyService } from "./default-new-policy.service";
import { POLICIES_NEW } from "./policy-state";

describe("DefaultNewPolicyService", () => {
  const userId = newGuid() as UserId;
  let stateProvider: FakeStateProvider;
  let organizationService: MockProxy<OrganizationService>;
  let singleUserState: FakeSingleUserState<Record<PolicyId, PolicyData>>;
  const accountService = mockAccountServiceWith(userId);

  let service: DefaultNewPolicyService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(accountService);
    organizationService = mock<OrganizationService>();
    singleUserState = stateProvider.singleUser.getFake(userId, POLICIES_NEW);

    service = new DefaultNewPolicyService(stateProvider, organizationService);
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

  describe("acceptedPolicies$", () => {
    beforeEach(() => {
      organizationService.organizations$
        .calledWith(userId)
        .mockReturnValue(
          of([
            organization("confirmed-org", OrganizationUserStatusType.Confirmed),
            organization("accepted-org", OrganizationUserStatusType.Accepted),
            organization("invited-org", OrganizationUserStatusType.Invited),
          ]),
        );
    });

    it("returns policies for organizations where the user has Accepted status", async () => {
      singleUserState.nextState(
        arrayToRecord([policyData("policy1", "accepted-org", PolicyType.DisableSend, true)]),
      );

      const result = await firstValueFrom(service.acceptedPolicies$(userId));

      expect(result).toHaveLength(1);
      expect(result[0].organizationId).toBe("accepted-org");
    });

    it("excludes policies for organizations where the user has Confirmed status", async () => {
      singleUserState.nextState(
        arrayToRecord([policyData("policy1", "confirmed-org", PolicyType.DisableSend, true)]),
      );

      const result = await firstValueFrom(service.acceptedPolicies$(userId));

      expect(result).toHaveLength(0);
    });

    it("excludes policies for organizations where the user has Invited status", async () => {
      singleUserState.nextState(
        arrayToRecord([policyData("policy1", "invited-org", PolicyType.DisableSend, true)]),
      );

      const result = await firstValueFrom(service.acceptedPolicies$(userId));

      expect(result).toHaveLength(0);
    });

    it("excludes policies for organizations not found in the org list", async () => {
      singleUserState.nextState(
        arrayToRecord([policyData("policy1", "unknown-org", PolicyType.DisableSend, true)]),
      );

      const result = await firstValueFrom(service.acceptedPolicies$(userId));

      expect(result).toHaveLength(0);
    });

    it("returns only Accepted-org policies when state contains a mix of org statuses", async () => {
      singleUserState.nextState(
        arrayToRecord([
          policyData("policy1", "accepted-org", PolicyType.DisableSend, true),
          policyData("policy2", "confirmed-org", PolicyType.ActivateAutofill, true),
          policyData("policy3", "invited-org", PolicyType.MaximumVaultTimeout, true),
          policyData("policy4", "unknown-org", PolicyType.DisableSend, false),
        ]),
      );

      const result = await firstValueFrom(service.acceptedPolicies$(userId));

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("policy1");
    });

    it("returns disabled policies (does not filter by enabled status)", async () => {
      singleUserState.nextState(
        arrayToRecord([policyData("policy1", "accepted-org", PolicyType.DisableSend, false)]),
      );

      const result = await firstValueFrom(service.acceptedPolicies$(userId));

      expect(result).toHaveLength(1);
    });

    it("returns empty array when state is empty", async () => {
      organizationService.organizations$
        .calledWith(userId)
        .mockReturnValue(of([organization("accepted-org", OrganizationUserStatusType.Accepted)]));
      singleUserState.nextState({});

      const result = await firstValueFrom(service.acceptedPolicies$(userId));

      expect(result).toHaveLength(0);
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

  function organizationData(id: string, status: OrganizationUserStatusType): OrganizationData {
    const od = new OrganizationData({} as any, {} as any);
    od.id = id;
    od.enabled = true;
    od.usePolicies = true;
    od.status = status;
    od.permissions = new PermissionsApi({} as any);
    return od;
  }

  function organization(id: string, status: OrganizationUserStatusType): Organization {
    return new Organization(organizationData(id, status));
  }

  function arrayToRecord(input: PolicyData[]): Record<PolicyId, PolicyData> {
    return Object.fromEntries(input.map((i) => [i.id, i]));
  }
});
