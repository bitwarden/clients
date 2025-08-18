import { BuiltIn, Profile } from "../metadata";

import { PassphrasePolicyConstraints } from "./passphrase-policy-constraints";

const SomeSettings = {
  capitalize: false,
  includeNumber: false,
  numWords: 3,
  wordSeparator: "-",
};

const disabledPolicy = {
  minNumberWords: 0,
  capitalize: false,
  includeNumber: false,
};
const someConstraints = BuiltIn.passphrase.profiles[Profile.account]!.constraints.default;

describe("PassphrasePolicyConstraints", () => {
  describe("constructor", () => {
    it("uses default boundaries when the policy is disabled", () => {
      const { constraints } = new PassphrasePolicyConstraints(disabledPolicy, someConstraints);

      expect(constraints.policyInEffect).toBeFalsy();
      expect(constraints.capitalize).toBeUndefined();
      expect(constraints.includeNumber).toBeUndefined();
      expect(constraints.numWords).toEqual(someConstraints.numWords);
    });

    it("requires capitalization when the policy requires capitalization", () => {
      const { constraints } = new PassphrasePolicyConstraints(
        {
          ...disabledPolicy,
          capitalize: true,
        },
        someConstraints,
      );

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.capitalize).toMatchObject({ readonly: true, requiredValue: true });
    });

    it("requires a number when the policy requires a number", () => {
      const { constraints } = new PassphrasePolicyConstraints(
        {
          ...disabledPolicy,
          includeNumber: true,
        },
        someConstraints,
      );

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.includeNumber).toMatchObject({ readonly: true, requiredValue: true });
    });

    it("minNumberWords <= numWords.min  when the policy requires numberCount", () => {
      const { constraints } = new PassphrasePolicyConstraints(
        {
          ...disabledPolicy,
          minNumberWords: 10,
        },
        someConstraints,
      );

      expect(constraints.policyInEffect).toBeTruthy();
      expect(constraints.numWords).toMatchObject({
        min: 10,
        max: someConstraints.numWords?.max,
      });
    });
  });

  describe("adjust", () => {
    it("allows an empty word separator", () => {
      const policy = new PassphrasePolicyConstraints(disabledPolicy, someConstraints);

      const { wordSeparator } = policy.adjust({ ...SomeSettings, wordSeparator: "" });

      expect(wordSeparator).toEqual("");
    });

    it("takes only the first character of wordSeparator", () => {
      const policy = new PassphrasePolicyConstraints(disabledPolicy, someConstraints);

      const { wordSeparator } = policy.adjust({ ...SomeSettings, wordSeparator: "?." });

      expect(wordSeparator).toEqual("?");
    });

    it.each([
      [1, someConstraints.numWords?.min, 3, someConstraints.numWords?.max],
      [21, someConstraints.numWords?.min, 20, someConstraints.numWords?.max],
    ])(
      `fits numWords (=%p) within the default bounds (%p <= %p <= %p)`,
      (value, _, expected, __) => {
        const policy = new PassphrasePolicyConstraints(disabledPolicy, someConstraints);

        const { numWords } = policy.adjust({ ...SomeSettings, numWords: value });

        expect(numWords).toEqual(expected);
      },
    );

    it.each([
      [1, 6, 6, someConstraints.numWords?.max],
      [21, 20, 20, someConstraints.numWords?.max],
    ])(
      "fits numWords (=%p) within the policy bounds (%p <= %p <= %p)",
      (value, minNumberWords, expected, _) => {
        const policy = new PassphrasePolicyConstraints(
          {
            ...disabledPolicy,
            minNumberWords,
          },
          someConstraints,
        );

        const { numWords } = policy.adjust({ ...SomeSettings, numWords: value });

        expect(numWords).toEqual(expected);
      },
    );

    it("sets capitalize to true when the policy requires it", () => {
      const policy = new PassphrasePolicyConstraints(
        {
          ...disabledPolicy,
          capitalize: true,
        },
        someConstraints,
      );

      const { capitalize } = policy.adjust({ ...SomeSettings, capitalize: false });

      expect(capitalize).toBeTruthy();
    });

    it("sets includeNumber to true when the policy requires it", () => {
      const policy = new PassphrasePolicyConstraints(
        {
          ...disabledPolicy,
          includeNumber: true,
        },
        someConstraints,
      );

      const { includeNumber } = policy.adjust({ ...SomeSettings, capitalize: false });

      expect(includeNumber).toBeTruthy();
    });
  });

  describe("fix", () => {
    it("returns its input", () => {
      const policy = new PassphrasePolicyConstraints(disabledPolicy, someConstraints);

      const result = policy.fix(SomeSettings);

      expect(result).toBe(SomeSettings);
    });
  });
});
