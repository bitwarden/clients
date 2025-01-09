import { DefaultGeneratorNavigation } from "./default-generator-navigation";
import { GeneratorNavigationEvaluator } from "./generator-navigation-evaluator";

describe("GeneratorNavigationEvaluator", () => {
  describe("policyInEffect", () => {
    it.each([["passphrase"], ["password"]] as const)(
      "returns true if the policy has a overridePasswordType (= %p)",
      (overridePasswordType) => {
        const evaluator = new GeneratorNavigationEvaluator({ overridePasswordType });

        expect(evaluator.policyInEffect).toEqual(true);
      },
    );

    it.each([[undefined], [null], ["" as any]])(
      "returns false if the policy has a falsy overridePasswordType (= %p)",
      (overridePasswordType) => {
        const evaluator = new GeneratorNavigationEvaluator({ overridePasswordType });

        expect(evaluator.policyInEffect).toEqual(false);
      },
    );
  });

  describe("applyPolicy", () => {
    it("returns the input options when a policy is not in effect", () => {
      const evaluator = new GeneratorNavigationEvaluator(null);
      const options = { type: "password" as const };

      const result = evaluator.applyPolicy(options);

      expect(result).toEqual(options);
    });

    it.each([["passphrase"], ["password"]] as const)(
      "defaults options to the policy's default type (= %p) when a policy is in effect",
      (overridePasswordType) => {
        const evaluator = new GeneratorNavigationEvaluator({ overridePasswordType });

        const result = evaluator.applyPolicy({});

        expect(result).toEqual({ type: overridePasswordType });
      },
    );
  });

  describe("sanitize", () => {
    it("retains the options type when it is set", () => {
      const evaluator = new GeneratorNavigationEvaluator({ overridePasswordType: "passphrase" });

      const result = evaluator.sanitize({ type: "password" });

      expect(result).toEqual({ type: "password" });
    });

    it("defaults options to the default generator navigation type when a policy is not in effect", () => {
      const evaluator = new GeneratorNavigationEvaluator(null);

      const result = evaluator.sanitize({});

      expect(result.type).toEqual(DefaultGeneratorNavigation.type);
    });
  });
});
