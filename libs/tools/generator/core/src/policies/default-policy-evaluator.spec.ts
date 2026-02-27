import { DefaultPolicyEvaluator } from "./default-policy-evaluator";

describe("Password generator options builder", () => {
  describe("policy", () => {
    it("should return an empty object", () => {
      const builder = new DefaultPolicyEvaluator();

      expect(builder.policy).toEqual({});
    });
  });

  describe("policyInEffect", () => {
    it("should return false", () => {
      const builder = new DefaultPolicyEvaluator();

      expect(builder.policyInEffect).toEqual(false);
    });
  });

  describe("applyPolicy(options)", () => {
    // All tests should freeze the options to ensure they are not modified
    it("should return the input operations without altering them", () => {
      const builder = new DefaultPolicyEvaluator();
      const options = Object.freeze({});

      const sanitizedOptions = builder.applyPolicy(options);

      expect(sanitizedOptions).toEqual(options);
    });
  });

  describe("sanitize(options)", () => {
    // All tests should freeze the options to ensure they are not modified
    it("should return the input options without altering them", () => {
      const builder = new DefaultPolicyEvaluator();
      const options = Object.freeze({});

      const sanitizedOptions = builder.sanitize(options);

      expect(sanitizedOptions).toEqual(options);
    });
  });
});
