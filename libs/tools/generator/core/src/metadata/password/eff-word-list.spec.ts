import { mock } from "jest-mock-extended";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";

import { PasswordRandomizer, SdkPasswordRandomizer } from "../../engine";
import { PassphrasePolicyConstraints } from "../../policies";
import { GeneratorDependencyProvider } from "../../providers";
import { PassphraseGenerationOptions } from "../../types";
import { Profile } from "../data";
import { CoreProfileMetadata } from "../profile-metadata";
import { isCoreProfile } from "../util";

import effPassphrase from "./eff-word-list";

const dependencyProvider = mock<GeneratorDependencyProvider>();

describe("password - eff words generator metadata", () => {
  describe("engine.create", () => {
    it("returns an sdk password randomizer", () => {
      expect(effPassphrase.engine.create(dependencyProvider)).toBeInstanceOf(SdkPasswordRandomizer);
    });
  });

  describe("engine.create", () => {
    const nonSdkDependencyProvider = mock<GeneratorDependencyProvider>();
    nonSdkDependencyProvider.sdk = undefined;
    it("returns a password randomizer", () => {
      expect(effPassphrase.engine.create(nonSdkDependencyProvider)).toBeInstanceOf(
        PasswordRandomizer,
      );
    });
  });

  describe("profiles[account]", () => {
    let accountProfile: CoreProfileMetadata<PassphraseGenerationOptions> | null = null;
    beforeEach(() => {
      const profile = effPassphrase.profiles[Profile.account];
      if (isCoreProfile(profile!)) {
        accountProfile = profile;
      } else {
        accountProfile = null;
      }
    });

    describe("storage.options.deserializer", () => {
      it("returns its input", () => {
        const value: PassphraseGenerationOptions = { ...accountProfile!.storage.initial };

        const result = accountProfile!.storage.options.deserializer(value);

        expect(result).toBe(value);
      });
    });

    describe("constraints.create", () => {
      // these tests check that the wiring is correct by exercising the behavior
      // of functionality encapsulated by `create`. These methods may fail if the
      // enclosed behaviors change.

      it("creates a passphrase policy constraints", () => {
        const context = { defaultConstraints: accountProfile!.constraints.default };

        const constraints = accountProfile!.constraints.create([], context);

        expect(constraints).toBeInstanceOf(PassphrasePolicyConstraints);
      });

      it("forwards the policy to the constraints", () => {
        const context = { defaultConstraints: accountProfile!.constraints.default };
        const policies = [
          {
            type: PolicyType.PasswordGenerator,
            data: {
              minNumberWords: 6,
              capitalize: false,
              includeNumber: false,
            },
          },
        ] as Policy[];

        const constraints = accountProfile!.constraints.create(policies, context);

        expect(constraints.constraints.numWords?.min).toEqual(6);
      });

      it("combines multiple policies in the constraints", () => {
        const context = { defaultConstraints: accountProfile!.constraints.default };
        const policies = [
          {
            type: PolicyType.PasswordGenerator,
            data: {
              minNumberWords: 6,
              capitalize: false,
              includeNumber: false,
            },
          },
          {
            type: PolicyType.PasswordGenerator,
            data: {
              minNumberWords: 3,
              capitalize: true,
              includeNumber: false,
            },
          },
        ] as Policy[];

        const constraints = accountProfile!.constraints.create(policies, context);

        expect(constraints.constraints.numWords?.min).toEqual(6);
        expect(constraints.constraints.capitalize?.requiredValue).toEqual(true);
      });
    });
  });
});
