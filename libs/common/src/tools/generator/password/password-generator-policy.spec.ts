import { PolicyType } from "../../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../../admin-console/models/domain/policy";
import { PolicyId } from "../../../types/guid";

import { DisabledPasswordGeneratorPolicy, leastPrivilege } from "./password-generator-policy";

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

describe("leastPrivilege", () => {
  it("should return the accumulator when the policy type does not apply", () => {
    const policy = createPolicy({}, PolicyType.RequireSso);

    const result = leastPrivilege(DisabledPasswordGeneratorPolicy, policy);

    expect(result).toEqual(DisabledPasswordGeneratorPolicy);
  });

  it("should return the accumulator when the policy is not enabled", () => {
    const policy = createPolicy({}, PolicyType.PasswordGenerator, false);

    const result = leastPrivilege(DisabledPasswordGeneratorPolicy, policy);

    expect(result).toEqual(DisabledPasswordGeneratorPolicy);
  });

  it.each([
    ["minLength", 10, "minLength"],
    ["useUpper", true, "useUppercase"],
    ["useLower", true, "useLowercase"],
    ["useNumbers", true, "useNumbers"],
    ["minNumbers", 10, "numberCount"],
    ["useSpecial", true, "useSpecial"],
    ["minSpecial", 10, "specialCount"],
  ])("should take the %p from the policy", (input, value, expected) => {
    const policy = createPolicy({ [input]: value });

    const result = leastPrivilege(DisabledPasswordGeneratorPolicy, policy);

    expect(result).toEqual({ ...DisabledPasswordGeneratorPolicy, [expected]: value });
  });
});
