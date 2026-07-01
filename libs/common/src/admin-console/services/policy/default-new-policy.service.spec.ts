import { firstValueFrom } from "rxjs";

import { newGuid } from "@bitwarden/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { FakeSingleUserState } from "../../../../spec/fake-state";
import { PolicyType } from "../../../admin-console/enums";
import { PolicyData } from "../../../admin-console/models/data/policy.data";
import { PolicyId, UserId } from "../../../types/guid";

import { DefaultNewPolicyService } from "./default-new-policy.service";
import { POLICIES_NEW } from "./policy-state";

describe("DefaultNewPolicyService", () => {
  const userId = newGuid() as UserId;
  let stateProvider: FakeStateProvider;
  let singleUserState: FakeSingleUserState<Record<PolicyId, PolicyData>>;
  const accountService = mockAccountServiceWith(userId);

  let service: DefaultNewPolicyService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(accountService);
    singleUserState = stateProvider.singleUser.getFake(userId, POLICIES_NEW);

    service = new DefaultNewPolicyService(stateProvider);
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

  function arrayToRecord(input: PolicyData[]): Record<PolicyId, PolicyData> {
    return Object.fromEntries(input.map((i) => [i.id, i]));
  }
});
