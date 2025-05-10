import { mock } from "jest-mock-extended";
import { of, firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultPassphraseGenerationOptions } from "../data";
import { PasswordRandomizer } from "../engine";
import { PassphraseGeneratorOptionsEvaluator } from "../policies";

import { PassphraseGeneratorStrategy } from "./passphrase-generator-strategy";
import { PASSPHRASE_SETTINGS } from "./storage";

const SomeUser = "some user" as UserId;

describe("Passphrase generation strategy", () => {
  describe("toEvaluator()", () => {
    it("should map to the policy evaluator", async () => {
      const strategy = new PassphraseGeneratorStrategy(null!, null!);
      const policy = mock<Policy>({
        type: PolicyType.PasswordGenerator,
        data: {
          minNumberWords: 10,
          capitalize: true,
          includeNumber: true,
        },
      });

      const evaluator$ = of([policy]).pipe(strategy.toEvaluator());
      const evaluator = await firstValueFrom(evaluator$);

      expect(evaluator).toBeInstanceOf(PassphraseGeneratorOptionsEvaluator);
      expect(evaluator.policy).toMatchObject({
        minNumberWords: 10,
        capitalize: true,
        includeNumber: true,
      });
    });

    it.each([[[]], [null], [undefined]])(
      "should map `%p` to a disabled password policy evaluator",
      async (policies) => {
        const strategy = new PassphraseGeneratorStrategy(null!, null!);

        // this case tests when the type system is subverted
        const evaluator$ = of(policies!).pipe(strategy.toEvaluator());
        const evaluator = await firstValueFrom(evaluator$);

        expect(evaluator).toBeInstanceOf(PassphraseGeneratorOptionsEvaluator);
        expect(evaluator.policy).toMatchObject({
          minNumberWords: 0,
          capitalize: false,
          includeNumber: false,
        });
      },
    );
  });

  describe("durableState", () => {
    it("should use password settings key", () => {
      const provider = mock<StateProvider>();
      const strategy = new PassphraseGeneratorStrategy(null!, provider);

      strategy.durableState(SomeUser);

      expect(provider.getUser).toHaveBeenCalledWith(SomeUser, PASSPHRASE_SETTINGS);
    });
  });

  describe("defaults$", () => {
    it("should return the default subaddress options", async () => {
      const strategy = new PassphraseGeneratorStrategy(null!, null!);

      const result = await firstValueFrom(strategy.defaults$(SomeUser));

      expect(result).toEqual(DefaultPassphraseGenerationOptions);
    });
  });

  describe("policy", () => {
    it("should use password generator policy", () => {
      const strategy = new PassphraseGeneratorStrategy(null!, null!);

      expect(strategy.policy).toBe(PolicyType.PasswordGenerator);
    });
  });

  describe("generate()", () => {
    const randomizer = mock<PasswordRandomizer>();
    beforeEach(() => {
      randomizer.randomEffLongWords.mockResolvedValue("passphrase");
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("should map options", async () => {
      const strategy = new PassphraseGeneratorStrategy(randomizer, null!);

      const result = await strategy.generate({
        numWords: 6,
        capitalize: true,
        includeNumber: true,
        wordSeparator: "!",
      });

      expect(result).toEqual("passphrase");
      expect(randomizer.randomEffLongWords).toHaveBeenCalledWith({
        numberOfWords: 6,
        capitalize: true,
        number: true,
        separator: "!",
      });
    });

    it("should default numWords", async () => {
      const strategy = new PassphraseGeneratorStrategy(randomizer, null!);

      const result = await strategy.generate({
        capitalize: true,
        includeNumber: true,
        wordSeparator: "!",
      });

      expect(result).toEqual("passphrase");
      expect(randomizer.randomEffLongWords).toHaveBeenCalledWith({
        numberOfWords: DefaultPassphraseGenerationOptions.numWords,
        capitalize: true,
        number: true,
        separator: "!",
      });
    });

    it("should default capitalize", async () => {
      const strategy = new PassphraseGeneratorStrategy(randomizer, null!);

      const result = await strategy.generate({
        numWords: 6,
        includeNumber: true,
        wordSeparator: "!",
      });

      expect(result).toEqual("passphrase");
      expect(randomizer.randomEffLongWords).toHaveBeenCalledWith({
        numberOfWords: 6,
        capitalize: DefaultPassphraseGenerationOptions.capitalize,
        number: true,
        separator: "!",
      });
    });

    it("should default includeNumber", async () => {
      const strategy = new PassphraseGeneratorStrategy(randomizer, null!);

      const result = await strategy.generate({
        numWords: 6,
        capitalize: true,
        wordSeparator: "!",
      });

      expect(result).toEqual("passphrase");
      expect(randomizer.randomEffLongWords).toHaveBeenCalledWith({
        numberOfWords: 6,
        capitalize: true,
        number: DefaultPassphraseGenerationOptions.includeNumber,
        separator: "!",
      });
    });

    it("should default wordSeparator", async () => {
      const strategy = new PassphraseGeneratorStrategy(randomizer, null!);

      const result = await strategy.generate({
        numWords: 6,
        capitalize: true,
        includeNumber: true,
      });

      expect(result).toEqual("passphrase");
      expect(randomizer.randomEffLongWords).toHaveBeenCalledWith({
        numberOfWords: 6,
        capitalize: true,
        number: true,
        separator: DefaultPassphraseGenerationOptions.wordSeparator,
      });
    });
  });
});
