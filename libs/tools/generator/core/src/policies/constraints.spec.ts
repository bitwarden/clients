import { Constraint } from "@bitwarden/common/tools/types";

import {
  atLeast,
  atLeastSum,
  maybe,
  maybeReadonly,
  fitToBounds,
  enforceConstant,
  fitLength,
  readonlyTrueWhen,
  RequiresTrue,
} from "./constraints";

const SomeBooleanConstraint: Constraint<boolean> = Object.freeze({});

describe("password generator constraint utilities", () => {
  describe("atLeast", () => {
    it("creates a minimum constraint when constraint is undefined", () => {
      const result = atLeast(1);

      expect(result).toEqual({ min: 1 });
    });

    it("returns the constraint when minimum is undefined", () => {
      const constraint = {};
      const result = atLeast(undefined, constraint);

      expect(result).toBe(constraint);
    });

    it("adds a minimum member to a constraint", () => {
      const result = atLeast(1, {});

      expect(result).toEqual({ min: 1 });
    });

    it("adjusts the minimum member of a constraint to the minimum value", () => {
      const result = atLeast(2, { min: 1 });

      expect(result).toEqual({ min: 2 });
    });

    it("adjusts the maximum member of a constraint to the minimum value", () => {
      const result = atLeast(2, { min: 0, max: 1 });

      expect(result).toEqual({ min: 2, max: 2 });
    });

    it("copies the constraint", () => {
      const constraint = { min: 1, step: 1 };

      const result = atLeast(1, constraint);

      expect(result).not.toBe(constraint);
      expect(result).toEqual({ min: 1, step: 1 });
    });
  });

  describe("atLeastSum", () => {
    it("creates a minimum constraint", () => {
      const result = atLeastSum(undefined, []);

      expect(result).toEqual({ min: 0 });
    });

    it("creates a minimum constraint that is the sum of the dependencies' minimums", () => {
      const result = atLeastSum(undefined, [{ min: 1 }, { min: 1 }]);

      expect(result).toEqual({ min: 2 });
    });

    it("adds a minimum member to a constraint", () => {
      const result = atLeastSum({}, []);

      expect(result).toEqual({ min: 0 });
    });

    it("adjusts the minimum member of a constraint to the minimum sum", () => {
      const result = atLeastSum({ min: 0 }, [{ min: 1 }]);

      expect(result).toEqual({ min: 1 });
    });

    it("adjusts the maximum member of a constraint to the minimum sum", () => {
      const result = atLeastSum({ min: 0, max: 1 }, [{ min: 2 }]);

      expect(result).toEqual({ min: 2, max: 2 });
    });

    it("copies the constraint", () => {
      const constraint = { step: 1 };

      const result = atLeastSum(constraint, []);

      expect(result).not.toBe(constraint);
      expect(result).toEqual({ min: 0, step: 1 });
    });
  });

  describe("maybe", () => {
    it("returns the constraint when it is enabled", () => {
      const result = maybe(true, SomeBooleanConstraint);

      expect(result).toBe(SomeBooleanConstraint);
    });

    it("returns undefined when the constraint is disabled", () => {
      const result = maybe(false, SomeBooleanConstraint);

      expect(result).toBeUndefined();
    });
  });

  describe("maybeReadonly", () => {
    it("returns the constraint when readonly is false", () => {
      const result = maybeReadonly(false, SomeBooleanConstraint);

      expect(result).toBe(SomeBooleanConstraint);
    });

    it("adds a readonly member when readonly is true", () => {
      const result = maybeReadonly(true, SomeBooleanConstraint);

      expect(result).toMatchObject({ readonly: true });
    });

    it("copies the constraint when readonly is true", () => {
      const result = maybeReadonly(true, { requiredValue: true });

      expect(result).not.toBe(SomeBooleanConstraint);
      expect(result).toMatchObject({ readonly: true, requiredValue: true });
    });

    it("crates a readonly constraint when the input is undefined", () => {
      const result = maybeReadonly(true);

      expect(result).not.toBe(SomeBooleanConstraint);
      expect(result).toEqual({ readonly: true });
    });
  });

  describe("fitToBounds", () => {
    it("returns the value when the constraint is undefined", () => {
      const result = fitToBounds(1, undefined);

      expect(result).toEqual(1);
    });

    it("applies the maximum bound", () => {
      const result = fitToBounds(2, { max: 1 });

      expect(result).toEqual(1);
    });

    it("applies the minimum bound", () => {
      const result = fitToBounds(0, { min: 1 });

      expect(result).toEqual(1);
    });

    it.each([[0], [1]])(
      "returns 0 when value is undefined and 0 <= the maximum bound (= %p)",
      (max) => {
        const result = fitToBounds(undefined, { max });

        expect(result).toEqual(0);
      },
    );

    it.each([[0], [-1]])(
      "returns 0 when value is undefined and 0 >= the minimum bound (= %p)",
      (min) => {
        const result = fitToBounds(undefined, { min });

        expect(result).toEqual(0);
      },
    );

    it("returns the maximum bound when value is undefined and 0 > the maximum bound", () => {
      const result = fitToBounds(undefined, { max: -1 });

      expect(result).toEqual(-1);
    });

    it("returns the minimum bound when value is undefined and 0 < the minimum bound", () => {
      const result = fitToBounds(undefined, { min: 1 });

      expect(result).toEqual(1);
    });
  });

  describe("fitLength", () => {
    it("returns the value when the constraint is undefined", () => {
      const result = fitLength("someValue", undefined);

      expect(result).toEqual("someValue");
    });

    it.each([[null], [undefined]])(
      "returns an empty string when the value is nullish (= %p)",
      (value: string) => {
        const result = fitLength(value, {});

        expect(result).toEqual("");
      },
    );

    it("applies the maxLength bound", () => {
      const result = fitLength("some value", { maxLength: 4 });

      expect(result).toEqual("some");
    });

    it("applies the minLength bound", () => {
      const result = fitLength("some", { minLength: 5 });

      expect(result).toEqual("some ");
    });

    it("fills characters from the fillString", () => {
      const result = fitLength("some", { minLength: 10 }, { fillString: " value" });

      expect(result).toEqual("some value");
    });

    it("repeats characters from the fillString", () => {
      const result = fitLength("i", { minLength: 3 }, { fillString: "+" });

      expect(result).toEqual("i++");
    });
  });

  describe("enforceConstant", () => {
    it("returns the requiredValue member from a readonly constraint", () => {
      const result = enforceConstant(false, { readonly: true, requiredValue: true });

      expect(result).toBeTruthy();
    });

    it("returns undefined from a readonly constraint without a required value", () => {
      const result = enforceConstant(false, { readonly: true });

      expect(result).toBeUndefined();
    });

    it.each([[{}], [{ readonly: false }]])(
      "returns value when the constraint is writable (= %p)",
      (constraint) => {
        const result = enforceConstant(false, constraint);

        expect(result).toBeFalsy();
      },
    );

    it("returns value when the constraint is undefined", () => {
      const result = enforceConstant(false, undefined);

      expect(result).toBeFalsy();
    });
  });

  describe("readonlyTrueWhen", () => {
    it.each([[false], [null], [undefined]])(
      "returns undefined when enabled is falsy (= %p)",
      (value) => {
        const result = readonlyTrueWhen(value);

        expect(result).toBeUndefined();
      },
    );

    it("returns a readonly RequiresTrue when enabled is true", () => {
      const result = readonlyTrueWhen(true);

      expect(result).toMatchObject({ readonly: true });
      expect(result).toMatchObject(RequiresTrue);
    });
  });
});
