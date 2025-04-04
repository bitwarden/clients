import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { PolicyId } from "@bitwarden/common/types/guid";

import { Algorithm, Algorithms, AlgorithmsByType } from "../metadata";

import { availableAlgorithms } from "./available-algorithms-policy";

describe("availableAlgorithms_vNextPolicy", () => {
  it("returns all algorithms", () => {
    const result = availableAlgorithms([]);

    for (const expected of Algorithms) {
      expect(result).toContain(expected);
    }
  });

  it.each([["password"], ["passphrase"]])("enforces a %p override", (override) => {
    const policy = new Policy({
      id: "" as PolicyId,
      organizationId: "",
      type: PolicyType.PasswordGenerator,
      data: {
        overridePasswordType: override,
      },
      enabled: true,
    });

    const result = availableAlgorithms([policy]);

    expect(result).toContain(override);

    for (const expected of AlgorithmsByType[Algorithm.password].filter((a) => a !== override)) {
      expect(result).not.toContain(expected);
    }
  });

  it.each([["password"], ["passphrase"]])("combines %p overrides", (override) => {
    const policy = new Policy({
      id: "" as PolicyId,
      organizationId: "",
      type: PolicyType.PasswordGenerator,
      data: {
        overridePasswordType: override,
      },
      enabled: true,
    });

    const result = availableAlgorithms([policy, policy]);

    expect(result).toContain(override);

    for (const expected of AlgorithmsByType[Algorithm.password].filter((a) => a !== override)) {
      expect(result).not.toContain(expected);
    }
  });

  it("overrides passphrase policies with password policies", () => {
    const password = new Policy({
      id: "" as PolicyId,
      organizationId: "",
      type: PolicyType.PasswordGenerator,
      data: {
        overridePasswordType: "password",
      },
      enabled: true,
    });
    const passphrase = new Policy({
      id: "" as PolicyId,
      organizationId: "",
      type: PolicyType.PasswordGenerator,
      data: {
        overridePasswordType: "passphrase",
      },
      enabled: true,
    });

    const result = availableAlgorithms([password, passphrase]);

    expect(result).toContain("password");

    for (const expected of AlgorithmsByType[Algorithm.password].filter((a) => a !== "password")) {
      expect(result).not.toContain(expected);
    }
  });

  it("ignores unrelated policies", () => {
    const policy = new Policy({
      id: "" as PolicyId,
      organizationId: "",
      type: PolicyType.ActivateAutofill,
      data: {
        some: "policy",
      },
      enabled: true,
    });

    const result = availableAlgorithms([policy]);

    for (const expected of Algorithms) {
      expect(result).toContain(expected);
    }
  });

  it("ignores disabled policies", () => {
    const policy = new Policy({
      id: "" as PolicyId,
      organizationId: "",
      type: PolicyType.PasswordGenerator,
      data: {
        some: "policy",
      },
      enabled: false,
    });

    const result = availableAlgorithms([policy]);

    for (const expected of Algorithms) {
      expect(result).toContain(expected);
    }
  });

  it("ignores policies without `overridePasswordType`", () => {
    const policy = new Policy({
      id: "" as PolicyId,
      organizationId: "",
      type: PolicyType.PasswordGenerator,
      data: {
        some: "policy",
      },
      enabled: true,
    });

    const result = availableAlgorithms([policy]);

    for (const expected of Algorithms) {
      expect(result).toContain(expected);
    }
  });
});
