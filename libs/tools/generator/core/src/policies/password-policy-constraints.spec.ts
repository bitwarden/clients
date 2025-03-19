import { PasswordGeneratorSettings } from "../types";

import { PasswordPolicyConstraints } from "./password-policy-constraints";

const EmptyState = {
  length: 0,
  ambiguous: false,
  lowercase: false,
  uppercase: false,
  number: false,
  special: false,
  minUppercase: 0,
  minLowercase: 0,
  minNumber: 0,
  minSpecial: 0,
};

describe("PasswordPolicyConstraints", () => {
  describe("adjust", () => {
    it("returns its input when the constraints are empty", () => {
      const constraint = new PasswordPolicyConstraints({});
      const expected = {
        length: -1,
        ambiguous: true,
        lowercase: true,
        uppercase: true,
        number: true,
        special: true,
        minUppercase: -1,
        minLowercase: -1,
        minNumber: -1,
        minSpecial: -1,
      };

      const result = constraint.adjust(expected);

      expect(result).toEqual(expected);
    });

    it.each([
      ["length", 0, 1],
      ["length", 1, 1],
      ["length", 2, 2],
      ["length", 3, 2],
      ["minLowercase", 0, 1],
      ["minLowercase", 1, 1],
      ["minLowercase", 2, 2],
      ["minLowercase", 3, 2],
      ["minUppercase", 0, 1],
      ["minUppercase", 1, 1],
      ["minUppercase", 2, 2],
      ["minUppercase", 3, 2],
      ["minNumber", 0, 1],
      ["minNumber", 1, 1],
      ["minNumber", 2, 2],
      ["minNumber", 3, 2],
      ["minSpecial", 0, 1],
      ["minSpecial", 1, 1],
      ["minSpecial", 2, 2],
      ["minSpecial", 3, 2],
    ] as [keyof PasswordGeneratorSettings, number, number][])(
      `fits %s (= %p) within the bounds (1 <= %p <= 2)`,
      (property, input, expected) => {
        const constraint = new PasswordPolicyConstraints({ [property]: { min: 1, max: 2 } });
        const state = { ...EmptyState, [property]: input };

        const result = constraint.adjust(state);

        expect(result).toMatchObject({ [property]: expected });
      },
    );

    it.each([["lowercase"], ["uppercase"], ["number"], ["special"]] as [
      keyof PasswordGeneratorSettings,
    ][])("returns state.%s when the matching readonly constraint is writable", (property) => {
      const constraint = new PasswordPolicyConstraints({ [property]: { readonly: false } });
      const state = { ...EmptyState, [property]: true };

      const result = constraint.adjust(state);

      expect(result).toEqual({ ...EmptyState, [property]: true });
    });

    it("sets `lowercase` and `uppercase` to `true` when no flags are defined", () => {
      const constraint = new PasswordPolicyConstraints({});
      const result = constraint.adjust(EmptyState);

      expect(result).toMatchObject({ lowercase: true, uppercase: true });
    });

    it.each([["number"], ["special"]] as [keyof PasswordGeneratorSettings][])(
      "returns a consistent state.%s = undefined when the matching readonly constraint is active without a required value",
      (property) => {
        const constraint = new PasswordPolicyConstraints({ [property]: { readonly: true } });
        const state = {
          ...EmptyState,
          [property]: true,
        };

        const result = constraint.adjust(state);

        expect(result).toMatchObject({ [property]: false });
      },
    );

    it.each([["number"], ["special"]] as [keyof PasswordGeneratorSettings][])(
      "returns state.%s = requiredValue when matching constraint is active with a required value",
      (property) => {
        const constraint = new PasswordPolicyConstraints({
          [property]: { readonly: true, requiredValue: false },
        });
        const state = { ...EmptyState, [property]: true };

        const result = constraint.adjust(state);

        expect(result).toMatchObject({ [property]: false });
      },
    );
  });

  describe("fix", () => {
    it("returns its input", () => {
      const policy = new PasswordPolicyConstraints({});

      const result = policy.fix(EmptyState);

      expect(result).toBe(EmptyState);
    });
  });
});
