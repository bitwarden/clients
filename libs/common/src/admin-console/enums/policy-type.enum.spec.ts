import { PolicyType } from "@bitwarden/common/admin-console/enums/policy-type.enum";

describe("PolicyType", () => {
  it("RemoveUnlockWithPin should be 14", () => {
    expect(PolicyType.RemoveUnlockWithPin).toBe(14);
  });

  it("HelpUsersUpdatePasswords should be 15", () => {
    expect(PolicyType.HelpUsersUpdatePasswords).toBe(15);
  });
});
