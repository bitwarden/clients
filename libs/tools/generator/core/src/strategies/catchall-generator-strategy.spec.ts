import { mock } from "jest-mock-extended";
import { of, firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultCatchallOptions } from "../data";
import { EmailCalculator, EmailRandomizer } from "../engine";
import { DefaultPolicyEvaluator } from "../policies";

import { CatchallGeneratorStrategy } from "./catchall-generator-strategy";
import { CATCHALL_SETTINGS } from "./storage";

const SomeUser = "some user" as UserId;
const SomePolicy = mock<Policy>({
  type: PolicyType.PasswordGenerator,
  data: {
    minLength: 10,
  },
});

describe("Email subaddress list generation strategy", () => {
  describe("toEvaluator()", () => {
    it.each([[[]], [null], [undefined], [[SomePolicy]], [[SomePolicy, SomePolicy]]])(
      "should map any input (= %p) to the default policy evaluator",
      async (policies) => {
        const strategy = new CatchallGeneratorStrategy(null, null, null);

        const evaluator$ = of(policies).pipe(strategy.toEvaluator());
        const evaluator = await firstValueFrom(evaluator$);

        expect(evaluator).toBeInstanceOf(DefaultPolicyEvaluator);
      },
    );
  });

  describe("durableState", () => {
    it("should use password settings key", () => {
      const provider = mock<StateProvider>();
      const strategy = new CatchallGeneratorStrategy(null, null, provider);

      strategy.durableState(SomeUser);

      expect(provider.getUser).toHaveBeenCalledWith(SomeUser, CATCHALL_SETTINGS);
    });
  });

  describe("defaults$", () => {
    it("should return the default subaddress options", async () => {
      const strategy = new CatchallGeneratorStrategy(null, null, null);

      const result = await firstValueFrom(strategy.defaults$(SomeUser));

      expect(result).toEqual(DefaultCatchallOptions);
    });
  });

  describe("policy", () => {
    it("should use password generator policy", () => {
      const strategy = new CatchallGeneratorStrategy(null, null, null);

      expect(strategy.policy).toBe(PolicyType.PasswordGenerator);
    });
  });

  describe("generate()", () => {
    it("generates a random catchall by default", async () => {
      const randomizer = mock<EmailRandomizer>();
      randomizer.randomAsciiCatchall.mockResolvedValue("catchall@example.com");
      const strategy = new CatchallGeneratorStrategy(null, randomizer, null);

      const result = await strategy.generate({ catchallDomain: "example.com", website: "" });

      expect(result).toEqual("catchall@example.com");
      expect(randomizer.randomAsciiCatchall).toHaveBeenCalledWith("example.com");
    });

    it("generates random catchall email addresses", async () => {
      const randomizer = mock<EmailRandomizer>();
      randomizer.randomAsciiCatchall.mockResolvedValue("catchall@example.com");
      const strategy = new CatchallGeneratorStrategy(null, randomizer, null);

      const result = await strategy.generate({
        catchallType: "random",
        catchallDomain: "example.com",
        website: "",
      });

      expect(result).toEqual("catchall@example.com");
      expect(randomizer.randomAsciiCatchall).toHaveBeenCalledWith("example.com");
    });

    it("generates catchall email addresses from website", async () => {
      const calculator = mock<EmailCalculator>();
      calculator.concatenate.mockReturnValue("catchall@example.com");
      const strategy = new CatchallGeneratorStrategy(calculator, null, null);

      const result = await strategy.generate({
        catchallType: "website-name",
        catchallDomain: "example.com",
        website: "foo.com",
      });

      expect(result).toEqual("catchall@example.com");
      expect(calculator.concatenate).toHaveBeenCalledWith("foo.com", "example.com");
    });
  });
});
