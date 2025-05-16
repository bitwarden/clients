import { mock } from "jest-mock-extended";

import { EmailRandomizer } from "../../engine";
import { SubaddressConstraints } from "../../policies/subaddress-constraints";
import { GeneratorDependencyProvider } from "../../providers";
import { SubaddressGenerationOptions } from "../../types";
import { Profile } from "../data";
import { CoreProfileMetadata } from "../profile-metadata";
import { isCoreProfile } from "../util";

import plusAddress from "./plus-address";

const dependencyProvider = mock<GeneratorDependencyProvider>();

describe("email - plus address generator metadata", () => {
  describe("engine.create", () => {
    it("returns an email randomizer", () => {
      expect(plusAddress.engine.create(dependencyProvider)).toBeInstanceOf(EmailRandomizer);
    });
  });

  describe("profiles[account]", () => {
    let accountProfile: CoreProfileMetadata<SubaddressGenerationOptions> = null!;
    beforeEach(() => {
      const profile = plusAddress.profiles[Profile.account];
      if (isCoreProfile(profile!)) {
        accountProfile = profile;
      } else {
        throw new Error("this branch should never run");
      }
    });

    describe("storage.options.deserializer", () => {
      it("returns its input", () => {
        const value: SubaddressGenerationOptions = {
          subaddressType: "random",
          subaddressEmail: "foo@example.com",
        };

        const result = accountProfile.storage.options.deserializer(value);

        expect(result).toBe(value);
      });
    });

    describe("constraints.create", () => {
      // these tests check that the wiring is correct by exercising the behavior
      // of functionality encapsulated by `create`. These methods may fail if the
      // enclosed behaviors change.

      it("creates a subaddress constraints", () => {
        const context = { defaultConstraints: {} };

        const constraints = accountProfile.constraints.create([], context);

        expect(constraints).toBeInstanceOf(SubaddressConstraints);
      });

      it("sets the constraint email to context.email", () => {
        const context = { email: "bar@example.com", defaultConstraints: {} };

        const constraints = accountProfile.constraints.create([], context) as SubaddressConstraints;

        expect(constraints.email).toEqual("bar@example.com");
      });
    });
  });
});
