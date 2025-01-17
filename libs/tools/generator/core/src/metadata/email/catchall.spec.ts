import { mock } from "jest-mock-extended";

import { EmailRandomizer } from "../../engine";
import { CatchallConstraints } from "../../policies/catchall-constraints";
import { CatchallGenerationOptions, GeneratorDependencyProvider } from "../../types";
import { Profile } from "../data";
import { CoreProfileMetadata } from "../profile-metadata";
import { isCoreProfile } from "../util";

import catchall from "./catchall";

const dependencyProvider = mock<GeneratorDependencyProvider>();

describe("email - catchall generator metadata", () => {
  describe("engine.create", () => {
    it("returns an email randomizer", () => {
      expect(catchall.engine.create(dependencyProvider)).toBeInstanceOf(EmailRandomizer);
    });
  });

  describe("profiles[account]", () => {
    let accountProfile: CoreProfileMetadata<CatchallGenerationOptions> = null;
    beforeEach(() => {
      const profile = catchall.profiles[Profile.account];
      if (isCoreProfile(profile)) {
        accountProfile = profile;
      }
    });

    describe("storage.options.deserializer", () => {
      it("returns its input", () => {
        const value: CatchallGenerationOptions = {
          catchallType: "random",
          catchallDomain: "example.com",
        };

        const result = accountProfile.storage.options.deserializer(value);

        expect(result).toBe(value);
      });
    });

    describe("constraints.create", () => {
      // these tests check that the wiring is correct by exercising the behavior
      // of functionality encapsulated by `create`. These methods may fail if the
      // enclosed behaviors change.

      it("creates a catchall constraints", () => {
        const context = { defaultConstraints: {} };

        const constraints = accountProfile.constraints.create([], context);

        expect(constraints).toBeInstanceOf(CatchallConstraints);
      });

      it("extracts the domain from context.email", () => {
        const context = { email: "foo@example.com", defaultConstraints: {} };

        const constraints = accountProfile.constraints.create([], context) as CatchallConstraints;

        expect(constraints.domain).toEqual("example.com");
      });
    });
  });
});
