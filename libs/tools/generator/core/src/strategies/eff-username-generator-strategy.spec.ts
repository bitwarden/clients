import { mock } from "jest-mock-extended";
import { of, firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultEffUsernameOptions } from "../data";
import { UsernameRandomizer } from "../engine";
import { DefaultPolicyEvaluator } from "../policies";

import { EffUsernameGeneratorStrategy } from "./eff-username-generator-strategy";
import { EFF_USERNAME_SETTINGS } from "./storage";

const SomeUser = "some user" as UserId;
const SomePolicy = mock<Policy>({
  type: PolicyType.PasswordGenerator,
  data: {
    minLength: 10,
  },
});

describe("EFF long word list generation strategy", () => {
  describe("toEvaluator()", () => {
    it.each([[[]], [null], [undefined], [[SomePolicy]], [[SomePolicy, SomePolicy]]])(
      "should map any input (= %p) to the default policy evaluator",
      async (policies) => {
        const strategy = new EffUsernameGeneratorStrategy(null, null);

        const evaluator$ = of(policies).pipe(strategy.toEvaluator());
        const evaluator = await firstValueFrom(evaluator$);

        expect(evaluator).toBeInstanceOf(DefaultPolicyEvaluator);
      },
    );
  });

  describe("durableState", () => {
    it("should use password settings key", () => {
      const provider = mock<StateProvider>();
      const strategy = new EffUsernameGeneratorStrategy(null, provider);

      strategy.durableState(SomeUser);

      expect(provider.getUser).toHaveBeenCalledWith(SomeUser, EFF_USERNAME_SETTINGS);
    });
  });

  describe("defaults$", () => {
    it("should return the default subaddress options", async () => {
      const strategy = new EffUsernameGeneratorStrategy(null, null);

      const result = await firstValueFrom(strategy.defaults$(SomeUser));

      expect(result).toEqual(DefaultEffUsernameOptions);
    });
  });

  describe("policy", () => {
    it("should use password generator policy", () => {
      const strategy = new EffUsernameGeneratorStrategy(null, null);

      expect(strategy.policy).toBe(PolicyType.PasswordGenerator);
    });
  });

  describe("generate()", () => {
    const randomizer = mock<UsernameRandomizer>();

    beforeEach(() => {
      randomizer.randomWords.mockResolvedValue("username");
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("generates a username", async () => {
      const strategy = new EffUsernameGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        wordCapitalize: false,
        wordIncludeNumber: false,
        website: null,
      });

      expect(result).toEqual("username");
      expect(randomizer.randomWords).toHaveBeenCalledWith({
        numberOfWords: 1,
        casing: "lowercase",
        digits: 0,
      });
    });

    it("includes a 4-digit number in the username", async () => {
      const strategy = new EffUsernameGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        wordCapitalize: false,
        wordIncludeNumber: true,
        website: null,
      });

      expect(result).toEqual("username");
      expect(randomizer.randomWords).toHaveBeenCalledWith({
        numberOfWords: 1,
        casing: "lowercase",
        digits: 4,
      });
    });

    it("capitalizes the username", async () => {
      const strategy = new EffUsernameGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        wordCapitalize: true,
        wordIncludeNumber: false,
        website: null,
      });

      expect(result).toEqual("username");
      expect(randomizer.randomWords).toHaveBeenCalledWith({
        numberOfWords: 1,
        casing: "TitleCase",
        digits: 0,
      });
    });

    it("defaults to lowercase", async () => {
      const strategy = new EffUsernameGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        wordIncludeNumber: false,
        website: null,
      });

      expect(result).toEqual("username");
      expect(randomizer.randomWords).toHaveBeenCalledWith({
        numberOfWords: 1,
        casing: "lowercase",
        digits: 0,
      });
    });

    it("defaults to a word without digits", async () => {
      const strategy = new EffUsernameGeneratorStrategy(randomizer, null);

      const result = await strategy.generate({
        wordCapitalize: false,
        website: null,
      });

      expect(result).toEqual("username");
      expect(randomizer.randomWords).toHaveBeenCalledWith({
        numberOfWords: 1,
        casing: "lowercase",
        digits: 0,
      });
    });
  });
});
