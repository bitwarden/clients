import { mock } from "jest-mock-extended";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";

import { SdkPasswordRandomizer } from "../../engine";
import { DynamicPasswordPolicyConstraints } from "../../policies";
import { PasswordGenerationOptions, GeneratorDependencyProvider } from "../../types";
import { Profile } from "../data";
import { CoreProfileMetadata } from "../profile-metadata";
import { isCoreProfile } from "../util";

import sdkPassword from "./sdk-random-password";

const dependencyProvider = mock<GeneratorDependencyProvider>();

describe("password - characters generator metadata", () => {
  describe("engine.create", () => {
    it("returns an email randomizer", () => {
      expect(sdkPassword.engine.create(dependencyProvider)).toBeInstanceOf(SdkPasswordRandomizer);
    });
  });

  describe("profiles[account]", () => {
    let accountProfile: CoreProfileMetadata<PasswordGenerationOptions> = null!;
    beforeEach(() => {
      const profile = sdkPassword.profiles[Profile.account];
      if (isCoreProfile(profile!)) {
        accountProfile = profile;
      } else {
        throw new Error("this branch should never run");
      }
    });

    describe("storage.options.deserializer", () => {
      it("returns its input", () => {
        const value: PasswordGenerationOptions = { ...accountProfile.storage.initial };

        const result = accountProfile.storage.options.deserializer(value);

        expect(result).toBe(value);
      });
    });

    describe("constraints.create", () => {
      // these tests check that the wiring is correct by exercising the behavior
      // of functionality encapsulated by `create`. These methods may fail if the
      // enclosed behaviors change.

      it("creates a passphrase policy constraints", () => {
        const context = { defaultConstraints: accountProfile.constraints.default };

        const constraints = accountProfile.constraints.create([], context);

        expect(constraints).toBeInstanceOf(DynamicPasswordPolicyConstraints);
      });

      it("forwards the policy to the constraints", () => {
        const context = { defaultConstraints: accountProfile.constraints.default };
        const policies = [
          {
            type: PolicyType.PasswordGenerator,
            enabled: true,
            data: {
              minLength: 10,
              capitalize: false,
              useNumbers: false,
            },
          },
        ] as Policy[];

        const constraints = accountProfile.constraints.create(policies, context);

        expect(constraints.constraints.length?.min).toEqual(10);
      });

      it("combines multiple policies in the constraints", () => {
        const context = { defaultConstraints: accountProfile.constraints.default };
        const policies = [
          {
            type: PolicyType.PasswordGenerator,
            enabled: true,
            data: {
              minLength: 14,
              useSpecial: false,
              useNumbers: false,
            },
          },
          {
            type: PolicyType.PasswordGenerator,
            enabled: true,
            data: {
              minLength: 10,
              useSpecial: true,
              includeNumber: false,
            },
          },
        ] as Policy[];

        const constraints = accountProfile.constraints.create(policies, context);

        expect(constraints.constraints.length?.min).toEqual(14);
        expect(constraints.constraints.special?.requiredValue).toEqual(true);
      });
    });
  });
});
