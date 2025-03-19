import { ObjectKey } from "@bitwarden/common/tools/state/object-key";

import { Generators } from "../data";
import { PasswordGeneratorSettings } from "../types";

import { AtLeastOne, Zero } from "./constraints";
import { DynamicPasswordPolicyConstraints } from "./dynamic-password-policy-constraints";

const accoutSettings = Generators.password.settings.account as ObjectKey<PasswordGeneratorSettings>;
const defaultOptions = accoutSettings.initial;
const disabledPolicy = Generators.password.policy.disabledValue;
const someConstraints = Generators.password.settings.constraints;

describe("DynamicPasswordPolicyConstraints", () => {
  describe("constructor", () => {
    it("uses default boundaries when the policy is disabled", () => {
      const { constraints } = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);

      expect(constraints.policyInEffect).toBeFalsy();
      expect(constraints.length).toEqual(someConstraints.length);
      expect(constraints.lowercase).toBeUndefined();
      expect(constraints.uppercase).toBeUndefined();
      expect(constraints.number).toBeUndefined();
      expect(constraints.special).toBeUndefined();
      expect(constraints.minLowercase).toBeUndefined();
      expect(constraints.minUppercase).toBeUndefined();
      expect(constraints.minNumber).toEqual(someConstraints.minNumber);
      expect(constraints.minSpecial).toEqual(someConstraints.minSpecial);
    });

    it("1 <= minLowercase when the policy requires lowercase", () => {
      const policy = { ...disabledPolicy, useLowercase: true };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.lowercase.readonly).toEqual(true);
      expect(constraints.lowercase.requiredValue).toEqual(true);
      expect(constraints.minLowercase).toEqual({ min: 1 });
    });

    it("1 <= minUppercase when the policy requires uppercase", () => {
      const policy = { ...disabledPolicy, useUppercase: true };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.uppercase.readonly).toEqual(true);
      expect(constraints.uppercase.requiredValue).toEqual(true);
      expect(constraints.minUppercase).toEqual({ min: 1 });
    });

    it("1 <= minNumber <= 9 when the policy requires a number", () => {
      const policy = { ...disabledPolicy, useNumbers: true };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.number.readonly).toEqual(true);
      expect(constraints.number.requiredValue).toEqual(true);
      expect(constraints.minNumber).toEqual({ min: 1, max: 9 });
    });

    it("1 <= minSpecial <= 9 when the policy requires a special character", () => {
      const policy = { ...disabledPolicy, useSpecial: true };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.special.readonly).toEqual(true);
      expect(constraints.special.requiredValue).toEqual(true);
      expect(constraints.minSpecial).toEqual({ min: 1, max: 9 });
    });

    it("numberCount <= minNumber <= 9 when the policy requires numberCount", () => {
      const policy = { ...disabledPolicy, useNumbers: true, numberCount: 2 };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.number.readonly).toEqual(true);
      expect(constraints.number.requiredValue).toEqual(true);
      expect(constraints.minNumber).toEqual({ min: 2, max: 9 });
    });

    it("specialCount <= minSpecial <= 9 when the policy requires specialCount", () => {
      const policy = { ...disabledPolicy, useSpecial: true, specialCount: 2 };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.special.readonly).toEqual(true);
      expect(constraints.special.requiredValue).toEqual(true);
      expect(constraints.minSpecial).toEqual({ min: 2, max: 9 });
    });

    it("uses the policy's minimum length when the policy defines one", () => {
      const policy = { ...disabledPolicy, minLength: 10 };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.length).toEqual({ ...someConstraints.length, min: 10 });
    });

    it("overrides the minimum length when it is less than the sum of minimums", () => {
      const policy = {
        ...disabledPolicy,
        useUppercase: true,
        useLowercase: true,
        useNumbers: true,
        numberCount: 5,
        useSpecial: true,
        specialCount: 5,
      };
      const { constraints } = new DynamicPasswordPolicyConstraints(policy, someConstraints);

      // lower + upper + number + special = 1 + 1 + 5 + 5 = 12
      expect(constraints.length).toEqual({ ...someConstraints.length, min: 12 });
    });
  });

  describe("calibrate", () => {
    it("copies the boolean constraints into the calibration", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(
        {
          ...disabledPolicy,
          useUppercase: true,
          useLowercase: true,
          useNumbers: true,
          useSpecial: true,
        },
        someConstraints,
      );

      const calibrated = dynamic.calibrate(defaultOptions);

      expect(calibrated.constraints.uppercase).toEqual(dynamic.constraints.uppercase);
      expect(calibrated.constraints.lowercase).toEqual(dynamic.constraints.lowercase);
      expect(calibrated.constraints.number).toEqual(dynamic.constraints.number);
      expect(calibrated.constraints.special).toEqual(dynamic.constraints.special);
    });

    it.each([[true], [false], [undefined]])(
      "outputs at least 1 constraint when the state's lowercase flag is true and useLowercase is %p",
      (useLowercase) => {
        const dynamic = new DynamicPasswordPolicyConstraints(
          {
            ...disabledPolicy,
            useLowercase,
          },
          someConstraints,
        );
        const state = {
          ...defaultOptions,
          lowercase: true,
        };

        const calibrated = dynamic.calibrate(state);

        expect(calibrated.constraints.minLowercase).toEqual(AtLeastOne);
      },
    );

    it("outputs the `minLowercase` constraint when the state's lowercase flag is true and policy is disabled", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);
      const state = {
        ...defaultOptions,
        lowercase: true,
      };

      const calibrated = dynamic.calibrate(state);

      expect(calibrated.constraints.minLowercase).toEqual(AtLeastOne);
    });

    it("disables the minLowercase constraint when the state's lowercase flag is false", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);
      const state = {
        ...defaultOptions,
        lowercase: false,
      };

      const calibrated = dynamic.calibrate(state);

      expect(calibrated.constraints.minLowercase).toBeUndefined();
    });

    it.each([[true], [false], [undefined]])(
      "outputs at least 1 constraint when the state's uppercase flag is true and useUppercase is %p",
      (useUppercase) => {
        const dynamic = new DynamicPasswordPolicyConstraints(
          {
            ...disabledPolicy,
            useUppercase,
          },
          someConstraints,
        );
        const state = {
          ...defaultOptions,
          uppercase: true,
        };

        const calibrated = dynamic.calibrate(state);

        expect(calibrated.constraints.minUppercase).toEqual(AtLeastOne);
      },
    );

    it("disables the minUppercase constraint when the state's uppercase flag is false", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);
      const state = {
        ...defaultOptions,
        uppercase: false,
      };

      const calibrated = dynamic.calibrate(state);

      expect(calibrated.constraints.minUppercase).toBeUndefined();
    });

    it("outputs the minNumber constraint when the state's number flag is true", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);
      const state = {
        ...defaultOptions,
        number: true,
      };

      const calibrated = dynamic.calibrate(state);

      expect(calibrated.constraints.minNumber).toEqual(dynamic.constraints.minNumber);
    });

    it("outputs the zero constraint when the state's number flag is false", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);
      const state = {
        ...defaultOptions,
        number: false,
      };

      const calibrated = dynamic.calibrate(state);

      expect(calibrated.constraints.minNumber).toEqual(Zero);
    });

    it("outputs the minSpecial constraint when the state's special flag is true", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);
      const state = {
        ...defaultOptions,
        special: true,
      };

      const calibrated = dynamic.calibrate(state);

      expect(calibrated.constraints.minSpecial).toEqual(dynamic.constraints.minSpecial);
    });

    it("outputs the zero constraint when the state's special flag is false", () => {
      const dynamic = new DynamicPasswordPolicyConstraints(disabledPolicy, someConstraints);
      const state = {
        ...defaultOptions,
        special: false,
      };

      const calibrated = dynamic.calibrate(state);

      expect(calibrated.constraints.minSpecial).toEqual(Zero);
    });
  });
});
