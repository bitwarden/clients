import { PolicyId } from "../../../types/guid";
import { PolicyType } from "../../enums";
import { PolicyData } from "../data/policy.data";

import { PolicyRecordMapper } from "./policy-sdk-mapper";

describe("PolicyRecordMapper", () => {
  const mapper = new PolicyRecordMapper();

  const policyData: PolicyData = {
    id: "6e6c3bb7-2c38-4e4b-8d3e-5a6f3b0b9a11" as PolicyId,
    organizationId: "1f0b6b4a-8c1d-4c5e-9f3a-2d7e8b9c0a12",
    type: PolicyType.MasterPassword,
    data: { minLength: 12, requireUpper: true },
    enabled: true,
    revisionDate: "2026-01-01T00:00:00.000Z",
  };

  it("maps PolicyData to an SDK policy", () => {
    expect(mapper.toSdk(policyData)).toEqual({
      id: policyData.id,
      organizationId: policyData.organizationId,
      type: PolicyType.MasterPassword,
      data: JSON.stringify(policyData.data),
      enabled: true,
      revisionDate: policyData.revisionDate,
    });
  });

  it("round-trips through the SDK representation", () => {
    expect(mapper.fromSdk(mapper.toSdk(policyData))).toEqual(policyData);
  });

  it("round-trips a policy with no data or revision date", () => {
    const emptyPolicy: PolicyData = { ...policyData, data: null, revisionDate: undefined };

    const sdkPolicy = mapper.toSdk(emptyPolicy);

    expect(sdkPolicy.data).toBeUndefined();
    expect(sdkPolicy.revisionDate).toBeUndefined();
    expect(mapper.fromSdk(sdkPolicy)).toEqual(emptyPolicy);
  });
});
