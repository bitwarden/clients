import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { VendorId } from "@bitwarden/common/tools/extension";
import { PrivateClassifier } from "@bitwarden/common/tools/private-classifier";
import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";

import { Algorithm, AlgorithmsByType } from "./data";
import { ProfileContext, ProfileMetadata } from "./profile-metadata";
import {
  isPasswordAlgorithm,
  isUsernameAlgorithm,
  isForwarderExtensionId,
  isEmailAlgorithm,
  isSameAlgorithm,
  isCoreProfile,
  isForwarderProfile,
} from "./util";

const SomeStorage: ObjectKey<object> = {
  target: "object",
  key: "arbitrary",
  state: GENERATOR_DISK,
  classifier: new PrivateClassifier(),
  format: "classified",
  options: { clearOn: [], deserializer: (value) => value },
};

function createConstraints(policies: Policy[], context: ProfileContext<object>) {
  return new IdentityConstraint();
}

describe("credential generator metadata utility functions", () => {
  describe("isPasswordAlgorithm", () => {
    it("returns `true` when the algorithm is a password algorithm", () => {
      for (const algorithm of AlgorithmsByType.password) {
        expect(isPasswordAlgorithm(algorithm)).toBe(true);
      }
    });

    it("returns `false` when the algorithm is an email algorithm", () => {
      for (const algorithm of AlgorithmsByType.email) {
        expect(isPasswordAlgorithm(algorithm)).toBe(false);
      }
    });

    it("returns `false` when the algorithm is a username algorithm", () => {
      for (const algorithm of AlgorithmsByType.username) {
        expect(isPasswordAlgorithm(algorithm)).toBe(false);
      }
    });

    it("returns `false` when the algorithm is a forwarder extension", () => {
      expect(isPasswordAlgorithm({ forwarder: "bitwarden" as VendorId })).toBe(false);
    });
  });

  describe("isUsernameAlgorithm", () => {
    it("returns `false` when the algorithm is a password algorithm", () => {
      for (const algorithm of AlgorithmsByType.password) {
        expect(isUsernameAlgorithm(algorithm)).toBe(false);
      }
    });

    it("returns `false` when the algorithm is an email algorithm", () => {
      for (const algorithm of AlgorithmsByType.email) {
        expect(isUsernameAlgorithm(algorithm)).toBe(false);
      }
    });

    it("returns `true` when the algorithm is a username algorithm", () => {
      for (const algorithm of AlgorithmsByType.username) {
        expect(isUsernameAlgorithm(algorithm)).toBe(true);
      }
    });

    it("returns `false` when the algorithm is a forwarder extension", () => {
      expect(isUsernameAlgorithm({ forwarder: "bitwarden" as VendorId })).toBe(false);
    });
  });

  describe("isForwarderExtensionId", () => {
    it("returns `false` when the algorithm is a password algorithm", () => {
      for (const algorithm of AlgorithmsByType.password) {
        expect(isForwarderExtensionId(algorithm)).toBe(false);
      }
    });

    it("returns `false` when the algorithm is an email algorithm", () => {
      for (const algorithm of AlgorithmsByType.email) {
        expect(isForwarderExtensionId(algorithm)).toBe(false);
      }
    });

    it("returns `false` when the algorithm is a username algorithm", () => {
      for (const algorithm of AlgorithmsByType.username) {
        expect(isForwarderExtensionId(algorithm)).toBe(false);
      }
    });

    it("returns `true` when the algorithm is a forwarder extension", () => {
      expect(isForwarderExtensionId({ forwarder: "bitwarden" as VendorId })).toBe(true);
    });
  });

  describe("isEmailAlgorithm", () => {
    it("returns `false` when the algorithm is a password algorithm", () => {
      for (const algorithm of AlgorithmsByType.password) {
        expect(isEmailAlgorithm(algorithm)).toBe(false);
      }
    });

    it("returns `true` when the algorithm is an email algorithm", () => {
      for (const algorithm of AlgorithmsByType.email) {
        expect(isEmailAlgorithm(algorithm)).toBe(true);
      }
    });

    it("returns `false` when the algorithm is a username algorithm", () => {
      for (const algorithm of AlgorithmsByType.username) {
        expect(isEmailAlgorithm(algorithm)).toBe(false);
      }
    });

    it("returns `true` when the algorithm is a forwarder extension", () => {
      expect(isEmailAlgorithm({ forwarder: "bitwarden" as VendorId })).toBe(true);
    });
  });

  describe("isSameAlgorithm", () => {
    it("returns `true` when the algorithms are equal", () => {
      // identical object
      expect(isSameAlgorithm(Algorithm.catchall, Algorithm.catchall)).toBe(true);

      // equal object
      expect(isSameAlgorithm(Algorithm.catchall, `${Algorithm.catchall}`)).toBe(true);
    });

    it("returns `false` when the algorithms are different", () => {
      // not an exhaustive list
      expect(isSameAlgorithm(Algorithm.catchall, Algorithm.passphrase)).toBe(false);
      expect(isSameAlgorithm(Algorithm.passphrase, Algorithm.password)).toBe(false);
      expect(isSameAlgorithm(Algorithm.password, Algorithm.plusAddress)).toBe(false);
      expect(isSameAlgorithm(Algorithm.plusAddress, Algorithm.username)).toBe(false);
      expect(isSameAlgorithm(Algorithm.username, Algorithm.passphrase)).toBe(false);
    });

    it("returns `true` when the algorithms refer to a forwarder with a matching vendor", () => {
      const someVendor = { forwarder: "bitwarden" as VendorId };
      const sameVendor = { forwarder: "bitwarden" as VendorId };
      expect(isSameAlgorithm(someVendor, sameVendor)).toBe(true);
    });

    it("returns `false` when the algorithms refer to a forwarder with a different vendor", () => {
      const someVendor = { forwarder: "bitwarden" as VendorId };
      const sameVendor = { forwarder: "bytewarden" as VendorId };
      expect(isSameAlgorithm(someVendor, sameVendor)).toBe(false);
    });

    it("returns `false` when the algorithms refer to a forwarder and a core algorithm", () => {
      const someVendor = { forwarder: "bitwarden" as VendorId };
      // not an exhaustive list
      expect(isSameAlgorithm(someVendor, Algorithm.plusAddress)).toBe(false);
      expect(isSameAlgorithm(Algorithm.username, someVendor)).toBe(false);
    });
  });

  describe("isCoreProfile", () => {
    it("returns `true` when the profile's type is `core`", () => {
      const profile: ProfileMetadata<object> = {
        type: "core",
        storage: SomeStorage,
        constraints: {
          default: {},
          create: createConstraints,
        },
      };

      expect(isCoreProfile(profile)).toBe(true);
    });

    it("returns `false` when the profile's type is `extension`", () => {
      const profile: ProfileMetadata<object> = {
        type: "extension",
        site: "forwarder",
        storage: SomeStorage,
        constraints: {
          default: {},
          create: createConstraints,
        },
      };

      expect(isCoreProfile(profile)).toBe(false);
    });
  });

  describe("isForwarderProfile", () => {
    it("returns `false` when the profile's type is `core`", () => {
      const profile: ProfileMetadata<object> = {
        type: "core",
        storage: SomeStorage,
        constraints: {
          default: {},
          create: createConstraints,
        },
      };

      expect(isForwarderProfile(profile)).toBe(false);
    });

    it("returns `true` when the profile's type is `extension` and the site is `forwarder`", () => {
      const profile: ProfileMetadata<object> = {
        type: "extension",
        site: "forwarder",
        storage: SomeStorage,
        constraints: {
          default: {},
          create: createConstraints,
        },
      };

      expect(isForwarderProfile(profile)).toBe(true);
    });

    it("returns `false` when the profile's type is `extension` and the site is not `forwarder`", () => {
      const profile: ProfileMetadata<object> = {
        type: "extension",
        site: "not-a-forwarder" as any,
        storage: SomeStorage,
        constraints: {
          default: {},
          create: createConstraints,
        },
      };

      expect(isForwarderProfile(profile)).toBe(false);
    });
  });
});
