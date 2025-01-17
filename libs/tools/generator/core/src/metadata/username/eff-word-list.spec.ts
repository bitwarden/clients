import { mock } from "jest-mock-extended";

import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";

import { UsernameRandomizer } from "../../engine";
import { EffUsernameGenerationOptions, GeneratorDependencyProvider } from "../../types";
import { Profile } from "../data";
import { CoreProfileMetadata } from "../profile-metadata";
import { isCoreProfile } from "../util";

import effWordList from "./eff-word-list";

const dependencyProvider = mock<GeneratorDependencyProvider>();

describe("username - eff words generator metadata", () => {
  describe("engine.create", () => {
    it("returns an email randomizer", () => {
      expect(effWordList.engine.create(dependencyProvider)).toBeInstanceOf(UsernameRandomizer);
    });
  });

  describe("profiles[account]", () => {
    let accountProfile: CoreProfileMetadata<EffUsernameGenerationOptions> = null;
    beforeEach(() => {
      const profile = effWordList.profiles[Profile.account];
      if (isCoreProfile(profile)) {
        accountProfile = profile;
      }
    });

    describe("storage.options.deserializer", () => {
      it("returns its input", () => {
        const value: EffUsernameGenerationOptions = {
          wordCapitalize: true,
          wordIncludeNumber: true,
        };

        const result = accountProfile.storage.options.deserializer(value);

        expect(result).toBe(value);
      });
    });

    describe("constraints.create", () => {
      // these tests check that the wiring is correct by exercising the behavior
      // of functionality encapsulated by `create`. These methods may fail if the
      // enclosed behaviors change.

      it("creates a effWordList constraints", () => {
        const context = { defaultConstraints: {} };

        const constraints = accountProfile.constraints.create([], context);

        expect(constraints).toBeInstanceOf(IdentityConstraint);
      });
    });
  });
});
