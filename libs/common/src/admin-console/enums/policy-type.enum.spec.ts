import { PolicyType } from "./policy-type.enum";

describe("PolicyType", () => {
  it("RemoveUnlockWithPin should be 14", () => {
    expect(PolicyType.RemoveUnlockWithPin).toBe(14);
  });
});
