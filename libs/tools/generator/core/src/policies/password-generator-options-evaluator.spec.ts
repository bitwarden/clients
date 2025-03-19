import { DefaultPasswordBoundaries, Policies } from "../data";
import { PasswordGenerationOptions } from "../types";

import { PasswordGeneratorOptionsEvaluator } from "./password-generator-options-evaluator";

describe("Password generator options builder", () => {
  const defaultOptions = Object.freeze({ minLength: 0 });

  describe("constructor()", () => {
    it("should set the policy object to a copy of the input policy", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.minLength = 10; // arbitrary change for deep equality check

      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policy).toEqual(policy);
      expect(builder.policy).not.toBe(policy);
    });

    it("should set default boundaries when a default policy is used", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);

      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.length).toEqual(DefaultPasswordBoundaries.length);
      expect(builder.minDigits).toEqual(DefaultPasswordBoundaries.minDigits);
      expect(builder.minSpecialCharacters).toEqual(DefaultPasswordBoundaries.minSpecialCharacters);
    });

    it.each([1, 2, 3, 4])(
      "should use the default length boundaries when they are greater than `policy.minLength` (= %i)",
      (minLength) => {
        expect(minLength).toBeLessThan(DefaultPasswordBoundaries.length.min);

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.minLength = minLength;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.length).toEqual(DefaultPasswordBoundaries.length);
      },
    );

    it.each([8, 20, 100])(
      "should use `policy.minLength` (= %i) when it is greater than the default minimum length",
      (expectedLength) => {
        expect(expectedLength).toBeGreaterThan(DefaultPasswordBoundaries.length.min);
        expect(expectedLength).toBeLessThanOrEqual(DefaultPasswordBoundaries.length.max);

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.minLength = expectedLength;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.length.min).toEqual(expectedLength);
        expect(builder.length.max).toEqual(DefaultPasswordBoundaries.length.max);
      },
    );

    it.each([150, 300, 9000])(
      "should use `policy.minLength` (= %i) when it is greater than the default boundaries",
      (expectedLength) => {
        expect(expectedLength).toBeGreaterThan(DefaultPasswordBoundaries.length.max);

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.minLength = expectedLength;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.length.min).toEqual(expectedLength);
        expect(builder.length.max).toEqual(expectedLength);
      },
    );

    it.each([3, 5, 8, 9])(
      "should use `policy.numberCount` (= %i) when it is greater than the default minimum digits",
      (expectedMinDigits) => {
        expect(expectedMinDigits).toBeGreaterThan(DefaultPasswordBoundaries.minDigits.min);
        expect(expectedMinDigits).toBeLessThanOrEqual(DefaultPasswordBoundaries.minDigits.max);

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.numberCount = expectedMinDigits;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.minDigits.min).toEqual(expectedMinDigits);
        expect(builder.minDigits.max).toEqual(DefaultPasswordBoundaries.minDigits.max);
      },
    );

    it.each([10, 20, 400])(
      "should use `policy.numberCount` (= %i) when it is greater than the default digit boundaries",
      (expectedMinDigits) => {
        expect(expectedMinDigits).toBeGreaterThan(DefaultPasswordBoundaries.minDigits.max);

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.numberCount = expectedMinDigits;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.minDigits.min).toEqual(expectedMinDigits);
        expect(builder.minDigits.max).toEqual(expectedMinDigits);
      },
    );

    it.each([2, 4, 6])(
      "should use `policy.specialCount` (= %i) when it is greater than the default minimum special characters",
      (expectedSpecialCharacters) => {
        expect(expectedSpecialCharacters).toBeGreaterThan(
          DefaultPasswordBoundaries.minSpecialCharacters.min,
        );
        expect(expectedSpecialCharacters).toBeLessThanOrEqual(
          DefaultPasswordBoundaries.minSpecialCharacters.max,
        );

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.specialCount = expectedSpecialCharacters;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.minSpecialCharacters.min).toEqual(expectedSpecialCharacters);
        expect(builder.minSpecialCharacters.max).toEqual(
          DefaultPasswordBoundaries.minSpecialCharacters.max,
        );
      },
    );

    it.each([10, 20, 400])(
      "should use `policy.specialCount` (= %i) when it is greater than the default special characters boundaries",
      (expectedSpecialCharacters) => {
        expect(expectedSpecialCharacters).toBeGreaterThan(
          DefaultPasswordBoundaries.minSpecialCharacters.max,
        );

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.specialCount = expectedSpecialCharacters;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.minSpecialCharacters.min).toEqual(expectedSpecialCharacters);
        expect(builder.minSpecialCharacters.max).toEqual(expectedSpecialCharacters);
      },
    );

    it.each([
      [8, 6, 2],
      [6, 2, 4],
      [16, 8, 8],
    ])(
      "should ensure the minimum length (= %i) is at least the sum of minimums (= %i + %i)",
      (expectedLength, numberCount, specialCount) => {
        expect(expectedLength).toBeGreaterThanOrEqual(DefaultPasswordBoundaries.length.min);

        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.numberCount = numberCount;
        policy.specialCount = specialCount;

        const builder = new PasswordGeneratorOptionsEvaluator(policy);

        expect(builder.length.min).toBeGreaterThanOrEqual(expectedLength);
      },
    );
  });

  describe("policyInEffect", () => {
    it("should return false when the policy has no effect", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(false);
    });

    it("should return true when the policy has a minlength greater than the default boundary", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.minLength = DefaultPasswordBoundaries.length.min + 1;
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(true);
    });

    it("should return true when the policy has a number count greater than the default boundary", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.numberCount = DefaultPasswordBoundaries.minDigits.min + 1;
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(true);
    });

    it("should return true when the policy has a special character count greater than the default boundary", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.specialCount = DefaultPasswordBoundaries.minSpecialCharacters.min + 1;
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(true);
    });

    it("should return true when the policy has uppercase enabled", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.useUppercase = true;
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(true);
    });

    it("should return true when the policy has lowercase enabled", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.useLowercase = true;
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(true);
    });

    it("should return true when the policy has numbers enabled", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.useNumbers = true;
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(true);
    });

    it("should return true when the policy has special characters enabled", () => {
      const policy: any = Object.assign({}, Policies.Password.disabledValue);
      policy.useSpecial = true;
      const builder = new PasswordGeneratorOptionsEvaluator(policy);

      expect(builder.policyInEffect).toEqual(true);
    });
  });

  describe("applyPolicy(options)", () => {
    // All tests should freeze the options to ensure they are not modified

    it.each([
      [false, false],
      [true, true],
      [false, undefined],
    ])(
      "should set `options.uppercase` to '%s' when `policy.useUppercase` is false and `options.uppercase` is '%s'",
      (expectedUppercase, uppercase) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useUppercase = false;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, uppercase });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.uppercase).toEqual(expectedUppercase);
      },
    );

    it.each([false, true, undefined])(
      "should set `options.uppercase` (= %s) to true when `policy.useUppercase` is true",
      (uppercase) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useUppercase = true;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, uppercase });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.uppercase).toEqual(true);
      },
    );

    it.each([
      [false, false],
      [true, true],
      [false, undefined],
    ])(
      "should set `options.lowercase` to '%s' when `policy.useLowercase` is false and `options.lowercase` is '%s'",
      (expectedLowercase, lowercase) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useLowercase = false;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, lowercase });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.lowercase).toEqual(expectedLowercase);
      },
    );

    it.each([false, true, undefined])(
      "should set `options.lowercase` (= %s) to true when `policy.useLowercase` is true",
      (lowercase) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useLowercase = true;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, lowercase });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.lowercase).toEqual(true);
      },
    );

    it.each([
      [false, false],
      [true, true],
      [false, undefined],
    ])(
      "should set `options.number` to '%s' when `policy.useNumbers` is false and `options.number` is '%s'",
      (expectedNumber, number) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useNumbers = false;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, number });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.number).toEqual(expectedNumber);
      },
    );

    it.each([false, true, undefined])(
      "should set `options.number` (= %s) to true when `policy.useNumbers` is true",
      (number) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useNumbers = true;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, number });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.number).toEqual(true);
      },
    );

    it.each([
      [false, false],
      [true, true],
      [false, undefined],
    ])(
      "should set `options.special` to '%s' when `policy.useSpecial` is false and `options.special` is '%s'",
      (expectedSpecial, special) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useSpecial = false;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, special });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.special).toEqual(expectedSpecial);
      },
    );

    it.each([false, true, undefined])(
      "should set `options.special` (= %s) to true when `policy.useSpecial` is true",
      (special) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.useSpecial = true;
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, special });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.special).toEqual(true);
      },
    );

    it.each([1, 2, 3, 4])(
      "should set `options.length` (= %i) to the minimum it is less than the minimum length",
      (length) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        expect(length).toBeLessThan(builder.length.min);

        const options = Object.freeze({ ...defaultOptions, length });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.length).toEqual(builder.length.min);
      },
    );

    it.each([5, 10, 50, 100, 128])(
      "should not change `options.length` (= %i) when it is within the boundaries",
      (length) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        expect(length).toBeGreaterThanOrEqual(builder.length.min);
        expect(length).toBeLessThanOrEqual(builder.length.max);

        const options = Object.freeze({ ...defaultOptions, length });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.length).toEqual(length);
      },
    );

    it.each([129, 500, 9000])(
      "should set `options.length` (= %i) to the maximum length when it is exceeded",
      (length) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        expect(length).toBeGreaterThan(builder.length.max);

        const options = Object.freeze({ ...defaultOptions, length });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.length).toEqual(builder.length.max);
      },
    );

    it.each([
      [true, 1],
      [true, 3],
      [true, 600],
      [false, 0],
      [false, -2],
      [false, -600],
    ])(
      "should set `options.number === %s` when `options.minNumber` (= %i) is set to a value greater than 0",
      (expectedNumber, minNumber) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, minNumber });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.number).toEqual(expectedNumber);
      },
    );

    it("should set `options.minNumber` to the minimum value when `options.number` is true", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);
      const builder = new PasswordGeneratorOptionsEvaluator(policy);
      const options = Object.freeze({ ...defaultOptions, number: true });

      const sanitizedOptions = builder.applyPolicy(options);

      expect(sanitizedOptions.minNumber).toEqual(builder.minDigits.min);
    });

    it("should set `options.minNumber` to 0 when `options.number` is false", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);
      const builder = new PasswordGeneratorOptionsEvaluator(policy);
      const options = Object.freeze({ ...defaultOptions, number: false });

      const sanitizedOptions = builder.applyPolicy(options);

      expect(sanitizedOptions.minNumber).toEqual(0);
    });

    it.each([1, 2, 3, 4])(
      "should set `options.minNumber` (= %i) to the minimum it is less than the minimum number",
      (minNumber) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.numberCount = 5; // arbitrary value greater than minNumber
        expect(minNumber).toBeLessThan(policy.numberCount);

        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, minNumber });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.minNumber).toEqual(builder.minDigits.min);
      },
    );

    it.each([1, 3, 5, 7, 9])(
      "should not change `options.minNumber` (= %i) when it is within the boundaries",
      (minNumber) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        expect(minNumber).toBeGreaterThanOrEqual(builder.minDigits.min);
        expect(minNumber).toBeLessThanOrEqual(builder.minDigits.max);

        const options = Object.freeze({ ...defaultOptions, minNumber });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.minNumber).toEqual(minNumber);
      },
    );

    it.each([10, 20, 400])(
      "should set `options.minNumber` (= %i) to the maximum digit boundary when it is exceeded",
      (minNumber) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        expect(minNumber).toBeGreaterThan(builder.minDigits.max);

        const options = Object.freeze({ ...defaultOptions, minNumber });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.minNumber).toEqual(builder.minDigits.max);
      },
    );

    it.each([
      [true, 1],
      [true, 3],
      [true, 600],
      [false, 0],
      [false, -2],
      [false, -600],
    ])(
      "should set `options.special === %s` when `options.minSpecial` (= %i) is set to a value greater than 0",
      (expectedSpecial, minSpecial) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, minSpecial });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.special).toEqual(expectedSpecial);
      },
    );

    it("should set `options.minSpecial` to the minimum value when `options.special` is true", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);
      const builder = new PasswordGeneratorOptionsEvaluator(policy);
      const options = Object.freeze({ ...defaultOptions, special: true });

      const sanitizedOptions = builder.applyPolicy(options);

      expect(sanitizedOptions.minSpecial).toEqual(builder.minDigits.min);
    });

    it("should set `options.minSpecial` to 0 when `options.special` is false", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);
      const builder = new PasswordGeneratorOptionsEvaluator(policy);
      const options = Object.freeze({ ...defaultOptions, special: false });

      const sanitizedOptions = builder.applyPolicy(options);

      expect(sanitizedOptions.minSpecial).toEqual(0);
    });

    it.each([1, 2, 3, 4])(
      "should set `options.minSpecial` (= %i) to the minimum it is less than the minimum special characters",
      (minSpecial) => {
        const policy: any = Object.assign({}, Policies.Password.disabledValue);
        policy.specialCount = 5; // arbitrary value greater than minSpecial
        expect(minSpecial).toBeLessThan(policy.specialCount);

        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ ...defaultOptions, minSpecial });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.minSpecial).toEqual(builder.minSpecialCharacters.min);
      },
    );

    it.each([1, 3, 5, 7, 9])(
      "should not change `options.minSpecial` (= %i) when it is within the boundaries",
      (minSpecial) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        expect(minSpecial).toBeGreaterThanOrEqual(builder.minSpecialCharacters.min);
        expect(minSpecial).toBeLessThanOrEqual(builder.minSpecialCharacters.max);

        const options = Object.freeze({ ...defaultOptions, minSpecial });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.minSpecial).toEqual(minSpecial);
      },
    );

    it.each([10, 20, 400])(
      "should set `options.minSpecial` (= %i) to the maximum special character boundary when it is exceeded",
      (minSpecial) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        expect(minSpecial).toBeGreaterThan(builder.minSpecialCharacters.max);

        const options = Object.freeze({ ...defaultOptions, minSpecial });

        const sanitizedOptions = builder.applyPolicy(options);

        expect(sanitizedOptions.minSpecial).toEqual(builder.minSpecialCharacters.max);
      },
    );

    it("should preserve unknown properties", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);
      const builder = new PasswordGeneratorOptionsEvaluator(policy);
      const options = Object.freeze({
        unknown: "property",
        another: "unknown property",
      }) as PasswordGenerationOptions;

      const sanitizedOptions: any = builder.applyPolicy(options);

      expect(sanitizedOptions.unknown).toEqual("property");
      expect(sanitizedOptions.another).toEqual("unknown property");
    });
  });

  describe("sanitize(options)", () => {
    // All tests should freeze the options to ensure they are not modified

    it.each([
      [1, true],
      [0, false],
    ])(
      "should output `options.minLowercase === %i` when `options.lowercase` is %s",
      (expectedMinLowercase, lowercase) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ lowercase, ...defaultOptions });

        const actual = builder.sanitize(options);

        expect(actual.minLowercase).toEqual(expectedMinLowercase);
      },
    );

    it.each([
      [1, true],
      [0, false],
    ])(
      "should output `options.minUppercase === %i` when `options.uppercase` is %s",
      (expectedMinUppercase, uppercase) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ uppercase, ...defaultOptions });

        const actual = builder.sanitize(options);

        expect(actual.minUppercase).toEqual(expectedMinUppercase);
      },
    );

    it.each([
      [1, true],
      [0, false],
    ])(
      "should output `options.minNumber === %i` when `options.number` is %s and `options.minNumber` is not set",
      (expectedMinNumber, number) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ number, ...defaultOptions });

        const actual = builder.sanitize(options);

        expect(actual.minNumber).toEqual(expectedMinNumber);
      },
    );

    it.each([
      [true, 3],
      [true, 2],
      [true, 1],
      [false, 0],
    ])(
      "should output `options.number === %s` when `options.minNumber` is %i and `options.number` is not set",
      (expectedNumber, minNumber) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ minNumber, ...defaultOptions });

        const actual = builder.sanitize(options);

        expect(actual.number).toEqual(expectedNumber);
      },
    );

    it.each([
      [true, 1],
      [false, 0],
    ])(
      "should output `options.minSpecial === %i` when `options.special` is %s and `options.minSpecial` is not set",
      (special, expectedMinSpecial) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ special, ...defaultOptions });

        const actual = builder.sanitize(options);

        expect(actual.minSpecial).toEqual(expectedMinSpecial);
      },
    );

    it.each([
      [3, true],
      [2, true],
      [1, true],
      [0, false],
    ])(
      "should output `options.special === %s` when `options.minSpecial` is %i and `options.special` is not set",
      (minSpecial, expectedSpecial) => {
        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({ minSpecial, ...defaultOptions });

        const actual = builder.sanitize(options);

        expect(actual.special).toEqual(expectedSpecial);
      },
    );

    it.each([
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 1, 1],
      [1, 1, 1, 1],
    ])(
      "should set `options.minLength` to the minimum boundary when the sum of minimums (%i + %i + %i + %i) is less than the default minimum length.",
      (minLowercase, minUppercase, minNumber, minSpecial) => {
        const sumOfMinimums = minLowercase + minUppercase + minNumber + minSpecial;
        expect(sumOfMinimums).toBeLessThan(DefaultPasswordBoundaries.length.min);

        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({
          minLowercase,
          minUppercase,
          minNumber,
          minSpecial,
          ...defaultOptions,
        });

        const actual = builder.sanitize(options);

        expect(actual.minLength).toEqual(builder.length.min);
      },
    );

    it.each([
      [12, 3, 3, 3, 3],
      [8, 2, 2, 2, 2],
      [9, 3, 3, 3, 0],
    ])(
      "should set `options.minLength === %i` to the sum of minimums (%i + %i + %i + %i) when the sum is at least the default minimum length.",
      (expectedMinLength, minLowercase, minUppercase, minNumber, minSpecial) => {
        expect(expectedMinLength).toBeGreaterThanOrEqual(DefaultPasswordBoundaries.length.min);

        const policy = Object.assign({}, Policies.Password.disabledValue);
        const builder = new PasswordGeneratorOptionsEvaluator(policy);
        const options = Object.freeze({
          minLowercase,
          minUppercase,
          minNumber,
          minSpecial,
          ...defaultOptions,
        });

        const actual = builder.sanitize(options);

        expect(actual.minLength).toEqual(expectedMinLength);
      },
    );

    it("should preserve unknown properties", () => {
      const policy = Object.assign({}, Policies.Password.disabledValue);
      const builder = new PasswordGeneratorOptionsEvaluator(policy);
      const options = Object.freeze({
        unknown: "property",
        another: "unknown property",
      }) as PasswordGenerationOptions;

      const sanitizedOptions: any = builder.sanitize(options);

      expect(sanitizedOptions.unknown).toEqual("property");
      expect(sanitizedOptions.another).toEqual("unknown property");
    });
  });
});
