import { mock } from "jest-mock-extended";
import { of, firstValueFrom } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
// FIXME: use index.ts imports once policy abstractions and models
// implement ADR-0002
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { DefaultSubaddressOptions } from "../data";
import { EmailCalculator, EmailRandomizer } from "../engine";
import { DefaultPolicyEvaluator } from "../policies";

import { SUBADDRESS_SETTINGS } from "./storage";
import { SubaddressGeneratorStrategy } from "./subaddress-generator-strategy";

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
        const strategy = new SubaddressGeneratorStrategy(null, null, null, null);

        const evaluator$ = of(policies).pipe(strategy.toEvaluator());
        const evaluator = await firstValueFrom(evaluator$);

        expect(evaluator).toBeInstanceOf(DefaultPolicyEvaluator);
      },
    );
  });

  describe("durableState", () => {
    it("should use password settings key", () => {
      const provider = mock<StateProvider>();
      const strategy = new SubaddressGeneratorStrategy(null, null, provider);

      strategy.durableState(SomeUser);

      expect(provider.getUser).toHaveBeenCalledWith(SomeUser, SUBADDRESS_SETTINGS);
    });
  });

  describe("defaults$", () => {
    it("should return the default subaddress options", async () => {
      const strategy = new SubaddressGeneratorStrategy(null, null, null);

      const result = await firstValueFrom(strategy.defaults$(SomeUser));

      expect(result).toEqual(DefaultSubaddressOptions);
    });
  });

  describe("policy", () => {
    it("should use password generator policy", () => {
      const strategy = new SubaddressGeneratorStrategy(null, null, null);

      expect(strategy.policy).toBe(PolicyType.PasswordGenerator);
    });
  });

  describe("generate()", () => {
    it("generates a random subaddress by default", async () => {
      const randomizer = mock<EmailRandomizer>();
      randomizer.randomAsciiSubaddress.mockResolvedValue("subaddress@example.com");
      const strategy = new SubaddressGeneratorStrategy(null, randomizer, null);

      const result = await strategy.generate({ subaddressEmail: "foo@example.com", website: "" });

      expect(result).toEqual("subaddress@example.com");
      expect(randomizer.randomAsciiSubaddress).toHaveBeenCalledWith("foo@example.com");
    });

    it("generate random catchall email addresses", async () => {
      const randomizer = mock<EmailRandomizer>();
      randomizer.randomAsciiSubaddress.mockResolvedValue("subaddress@example.com");
      const strategy = new SubaddressGeneratorStrategy(null, randomizer, null);

      const result = await strategy.generate({
        subaddressType: "random",
        subaddressEmail: "foo@example.com",
        website: "",
      });

      expect(result).toEqual("subaddress@example.com");
      expect(randomizer.randomAsciiSubaddress).toHaveBeenCalledWith("foo@example.com");
    });

    it("generate catchall email addresses from website", async () => {
      const calculator = mock<EmailCalculator>();
      calculator.appendToSubaddress.mockReturnValue("subaddress@example.com");
      const strategy = new SubaddressGeneratorStrategy(calculator, null, null);

      const result = await strategy.generate({
        subaddressType: "website-name",
        subaddressEmail: "foo@example.com",
        website: "bar.com",
      });

      expect(result).toEqual("subaddress@example.com");
      expect(calculator.appendToSubaddress).toHaveBeenCalledWith("bar.com", "foo@example.com");
    });
  });
});
