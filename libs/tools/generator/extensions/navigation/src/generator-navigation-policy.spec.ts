import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { PolicyId } from "@bitwarden/common/types/guid";

import { DisabledGeneratorNavigationPolicy, preferPassword } from "./generator-navigation-policy";

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

    const result = preferPassword(DisabledGeneratorNavigationPolicy, policy);

    expect(result).toEqual(DisabledGeneratorNavigationPolicy);
  });

  it("should return the accumulator when the policy is not enabled", () => {
    const policy = createPolicy({}, PolicyType.PasswordGenerator, false);

    const result = preferPassword(DisabledGeneratorNavigationPolicy, policy);

    expect(result).toEqual(DisabledGeneratorNavigationPolicy);
  });

  it("should take the %p from the policy", () => {
    const policy = createPolicy({ overridePasswordType: "passphrase" });

    const result = preferPassword({ ...DisabledGeneratorNavigationPolicy }, policy);

    expect(result).toEqual({ overridePasswordType: "passphrase" });
  });

  it("should override passphrase with password", () => {
    const policy = createPolicy({ overridePasswordType: "password" });

    const result = preferPassword({ overridePasswordType: "passphrase" }, policy);

    expect(result).toEqual({ overridePasswordType: "password" });
  });

  it("should not override password", () => {
    const policy = createPolicy({ overridePasswordType: "passphrase" });

    const result = preferPassword({ overridePasswordType: "password" }, policy);

    expect(result).toEqual({ overridePasswordType: "password" });
  });
});
