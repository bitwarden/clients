import { PolicyType } from "../../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../../admin-console/models/domain/policy";
import { PolicyId } from "../../../types/guid";

import { DisabledPassphraseGeneratorPolicy, leastPrivilege } from "./passphrase-generator-policy";

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

    const result = leastPrivilege(DisabledPassphraseGeneratorPolicy, policy);

    expect(result).toEqual(DisabledPassphraseGeneratorPolicy);
  });

  it("should return the accumulator when the policy is not enabled", () => {
    const policy = createPolicy({}, PolicyType.PasswordGenerator, false);

    const result = leastPrivilege(DisabledPassphraseGeneratorPolicy, policy);

    expect(result).toEqual(DisabledPassphraseGeneratorPolicy);
  });

  it.each([
    ["minNumberWords", 10],
    ["capitalize", true],
    ["includeNumber", true],
  ])("should take the %p from the policy", (input, value) => {
    const policy = createPolicy({ [input]: value });

    const result = leastPrivilege(DisabledPassphraseGeneratorPolicy, policy);

    expect(result).toEqual({ ...DisabledPassphraseGeneratorPolicy, [input]: value });
  });
});
