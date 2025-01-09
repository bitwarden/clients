import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { PolicyId } from "@bitwarden/common/types/guid";

import { Policies } from "../data";

import { passphraseLeastPrivilege } from "./passphrase-least-privilege";

function createPolicy(
  data: any,
  type: PolicyType = PolicyType.PasswordGenerator,
  enabled: boolean = true,
) {
  return new Policy({
    id: "id" as PolicyId,
    organizationId: "organizationId",
    data,
    enabled,
    type,
  });
}

describe("passphraseLeastPrivilege", () => {
  it("should return the accumulator when the policy type does not apply", () => {
    const policy = createPolicy({}, PolicyType.RequireSso);

    const result = passphraseLeastPrivilege(Policies.Passphrase.disabledValue, policy);

    expect(result).toEqual(Policies.Passphrase.disabledValue);
  });

  it("should return the accumulator when the policy is not enabled", () => {
    const policy = createPolicy({}, PolicyType.PasswordGenerator, false);

    const result = passphraseLeastPrivilege(Policies.Passphrase.disabledValue, policy);

    expect(result).toEqual(Policies.Passphrase.disabledValue);
  });

  it.each([
    ["minNumberWords", 10],
    ["capitalize", true],
    ["includeNumber", true],
  ])("should take the %p from the policy", (input, value) => {
    const policy = createPolicy({ [input]: value });

    const result = passphraseLeastPrivilege(Policies.Passphrase.disabledValue, policy);

    expect(result).toEqual({ ...Policies.Passphrase.disabledValue, [input]: value });
  });
});
