/**
 * include structuredClone in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */

import { mock } from "jest-mock-extended";

import { PolicyType } from "../../../admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "../../../admin-console/models/domain/policy";
import { StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { PASSWORD_SETTINGS } from "../key-definitions";

import { DisabledPasswordGeneratorPolicy } from "./password-generator-policy";

import {
  PasswordGenerationServiceAbstraction,
  PasswordGeneratorOptionsEvaluator,
  PasswordGeneratorStrategy,
} from ".";

const SomeUser = "some user" as UserId;

describe("Password generation strategy", () => {
  describe("evaluator()", () => {
    it("should throw if the policy type is incorrect", () => {
      const strategy = new PasswordGeneratorStrategy(null, null);
      const policy = mock<Policy>({
        type: PolicyType.DisableSend,
      });

      expect(() => strategy.evaluator(policy)).toThrow(new RegExp("Mismatched policy type\\. .+"));
    });

    it("should map to the policy evaluator", () => {
      const strategy = new PasswordGeneratorStrategy(null, null);
      const policy = mock<Policy>({
        type: PolicyType.PasswordGenerator,
        data: {
          minLength: 10,
          useUpper: true,
          useLower: true,
          useNumbers: true,
          minNumbers: 1,
          useSpecial: true,
          minSpecial: 1,
        },
      });

      const evaluator = strategy.evaluator(policy);

      expect(evaluator).toBeInstanceOf(PasswordGeneratorOptionsEvaluator);
      expect(evaluator.policy).toMatchObject({
        minLength: 10,
        useUppercase: true,
        useLowercase: true,
        useNumbers: true,
        numberCount: 1,
        useSpecial: true,
        specialCount: 1,
      });
    });

    it("should map `null`  to a default policy evaluator", () => {
      const strategy = new PasswordGeneratorStrategy(null, null);
      const evaluator = strategy.evaluator(null);

      expect(evaluator).toBeInstanceOf(PasswordGeneratorOptionsEvaluator);
      expect(evaluator.policy).toMatchObject(DisabledPasswordGeneratorPolicy);
    });
  });

  describe("durableState", () => {
    it("should use password settings key", () => {
      const provider = mock<StateProvider>();
      const legacy = mock<PasswordGenerationServiceAbstraction>();
      const strategy = new PasswordGeneratorStrategy(legacy, provider);

      strategy.durableState(SomeUser);

      expect(provider.getUser).toHaveBeenCalledWith(SomeUser, PASSWORD_SETTINGS);
    });
  });

  describe("cache_ms", () => {
    it("should be a positive non-zero number", () => {
      const legacy = mock<PasswordGenerationServiceAbstraction>();
      const strategy = new PasswordGeneratorStrategy(legacy, null);

      expect(strategy.cache_ms).toBeGreaterThan(0);
    });
  });

  describe("policy", () => {
    it("should use password generator policy", () => {
      const legacy = mock<PasswordGenerationServiceAbstraction>();
      const strategy = new PasswordGeneratorStrategy(legacy, null);

      expect(strategy.policy).toBe(PolicyType.PasswordGenerator);
    });
  });

  describe("generate()", () => {
    it("should call the legacy service with the given options", async () => {
      const legacy = mock<PasswordGenerationServiceAbstraction>();
      const strategy = new PasswordGeneratorStrategy(legacy, null);
      const options = {
        type: "password",
        minLength: 1,
        useUppercase: true,
        useLowercase: true,
        useNumbers: true,
        numberCount: 1,
        useSpecial: true,
        specialCount: 1,
      };

      await strategy.generate(options);

      expect(legacy.generatePassword).toHaveBeenCalledWith(options);
    });

    it("should set the generation type to password", async () => {
      const legacy = mock<PasswordGenerationServiceAbstraction>();
      const strategy = new PasswordGeneratorStrategy(legacy, null);

      await strategy.generate({ type: "foo" } as any);

      expect(legacy.generatePassword).toHaveBeenCalledWith({ type: "password" });
    });
  });
});
