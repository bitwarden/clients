import { PolicyType } from "@bitwarden/common/admin-console/enums/policy-type.enum";

describe("PolicyType", () => {
  it("RemoveUnlockWithPin should be 14", () => {
    expect(PolicyType.RemoveUnlockWithPin).toBe(14);
  });
});
