import { mock } from "jest-mock-extended";
import { of, firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultPasswordGenerationOptions, Policies } from "../data";
import { PasswordRandomizer } from "../engine";
import { PasswordGeneratorOptionsEvaluator } from "../policies";

import { PasswordGeneratorStrategy } from "./password-generator-strategy";
import { PASSWORD_SETTINGS } from "./storage";

const SomeUser = "some user" as UserId;

describe("Password generation strategy", () => {
  describe("toEvaluator()", () => {
    it("should map to a password policy evaluator", async () => {
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

      const evaluator$ = of([policy]).pipe(strategy.toEvaluator());
      const evaluator = await firstValueFrom(evaluator$);

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

    it.each([[[]], [null], [undefined]])(
      "should map `%p` to a disabled password policy evaluator",
      async (policies) => {
        const strategy = new PasswordGeneratorStrategy(null, null);

        const evaluator$ = of(policies).pipe(strategy.toEvaluator());
        const evaluator = await firstValueFrom(evaluator$);

        expect(evaluator).toBeInstanceOf(PasswordGeneratorOptionsEvaluator);
        expect(evaluator.policy).toMatchObject(Policies.Password.disabledValue);
      },
    );
  });

  describe("durableState", () => {
    it("should use password settings key", () => {
      const provider = mock<StateProvider>();
      const strategy = new PasswordGeneratorStrategy(null, provider);

      strategy.durableState(SomeUser);

      expect(provider.getUser).toHaveBeenCalledWith(SomeUser, PASSWORD_SETTINGS);
    });
  });

  describe("defaults$", () => {
    it("should return the default subaddress options", async () => {
      const strategy = new PasswordGeneratorStrategy(null, null);

      const result = await firstValueFrom(strategy.defaults$(SomeUser));

      expect(result).toEqual(DefaultPasswordGenerationOptions);
    });
  });

  describe("policy", () => {
    it("should use password generator policy", () => {
      const strategy = new PasswordGeneratorStrategy(null, null);

      expect(strategy.policy).toBe(PolicyType.PasswordGenerator);
    });
  });

  describe("generate()", () => {
    const randomizer = mock<PasswordRandomizer>();
    beforeEach(() => {
      randomizer.randomAscii.mockResolvedValue("password");
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should map options", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 20,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
        minUppercase: 1,
        minLowercase: 2,
        minNumber: 3,
        minSpecial: 4,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 10,
        uppercase: 1,
        lowercase: 2,
        digits: 3,
        special: 4,
        ambiguous: true,
      });
    });

    it("should disable uppercase", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 3,
        ambiguous: true,
        uppercase: false,
        lowercase: true,
        number: true,
        special: true,
        minUppercase: 1,
        minLowercase: 1,
        minNumber: 1,
        minSpecial: 1,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: undefined,
        lowercase: 1,
        digits: 1,
        special: 1,
        ambiguous: true,
      });
    });

    it("should disable lowercase", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 3,
        ambiguous: true,
        uppercase: true,
        lowercase: false,
        number: true,
        special: true,
        minUppercase: 1,
        minLowercase: 1,
        minNumber: 1,
        minSpecial: 1,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 1,
        lowercase: undefined,
        digits: 1,
        special: 1,
        ambiguous: true,
      });
    });

    it("should disable digits", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 3,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: false,
        special: true,
        minUppercase: 1,
        minLowercase: 1,
        minNumber: 1,
        minSpecial: 1,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 1,
        lowercase: 1,
        digits: undefined,
        special: 1,
        ambiguous: true,
      });
    });

    it("should disable special", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 3,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: false,
        minUppercase: 1,
        minLowercase: 1,
        minNumber: 1,
        minSpecial: 1,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 1,
        lowercase: 1,
        digits: 1,
        special: undefined,
        ambiguous: true,
      });
    });

    it("should override length with minimums", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 20,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
        minUppercase: 1,
        minLowercase: 2,
        minNumber: 3,
        minSpecial: 4,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 10,
        uppercase: 1,
        lowercase: 2,
        digits: 3,
        special: 4,
        ambiguous: true,
      });
    });

    it("should default uppercase", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 2,
        ambiguous: true,
        lowercase: true,
        number: true,
        special: true,
        minUppercase: 2,
        minLowercase: 0,
        minNumber: 0,
        minSpecial: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 2,
        lowercase: 0,
        digits: 0,
        special: 0,
        ambiguous: true,
      });
    });

    it("should default lowercase", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 0,
        ambiguous: true,
        uppercase: true,
        number: true,
        special: true,
        minUppercase: 0,
        minLowercase: 2,
        minNumber: 0,
        minSpecial: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 0,
        lowercase: 2,
        digits: 0,
        special: 0,
        ambiguous: true,
      });
    });

    it("should default number", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 0,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        special: true,
        minUppercase: 0,
        minLowercase: 0,
        minNumber: 2,
        minSpecial: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 0,
        lowercase: 0,
        digits: 2,
        special: 0,
        ambiguous: true,
      });
    });

    it("should default special", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 0,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        minUppercase: 0,
        minLowercase: 0,
        minNumber: 0,
        minSpecial: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 0,
        lowercase: 0,
        digits: 0,
        special: undefined,
        ambiguous: true,
      });
    });

    it("should default minUppercase", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 0,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
        minLowercase: 0,
        minNumber: 0,
        minSpecial: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 1,
        lowercase: 0,
        digits: 0,
        special: 0,
        ambiguous: true,
      });
    });

    it("should default minLowercase", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 0,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
        minUppercase: 0,
        minNumber: 0,
        minSpecial: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 0,
        lowercase: 1,
        digits: 0,
        special: 0,
        ambiguous: true,
      });
    });

    it("should default minNumber", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 0,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
        minUppercase: 0,
        minLowercase: 0,
        minSpecial: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 0,
        lowercase: 0,
        digits: 1,
        special: 0,
        ambiguous: true,
      });
    });

    it("should default minSpecial", async () => {
      const strategy = new PasswordGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        length: 0,
        ambiguous: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
        minUppercase: 0,
        minLowercase: 0,
        minNumber: 0,
      });

      expect(result).toEqual("password");
      expect(randomizer.randomAscii).toHaveBeenCalledWith({
        all: 0,
        uppercase: 0,
        lowercase: 0,
        digits: 0,
        special: 0,
        ambiguous: true,
      });
    });
  });
});
