import {
  createBoundedArrayGuard,
  createValidator,
  isBoolean,
  isBooleanRecord,
  isBoundedArray,
  isBoundedPositiveNumber,
  isBoundedString,
  isBoundedStringOrNull,
  isBoundedStringOrUndefined,
  isDate,
  isDateOrNull,
  isDateString,
  isDateStringOrNull,
  isDateStringOrUndefined,
  BOUNDED_ARRAY_MAX_LENGTH,
  BOUNDED_STRING_MAX_LENGTH,
} from "./basic-type-guards";

describe("basic-type-guards", () => {
  describe("isBoolean", () => {
    it("should return true for true", () => expect(isBoolean(true)).toBe(true));
    it("should return true for false", () => expect(isBoolean(false)).toBe(true));
    it("should return false for 1", () => expect(isBoolean(1)).toBe(false));
    it("should return false for string", () => expect(isBoolean("true")).toBe(false));
    it("should return false for null", () => expect(isBoolean(null)).toBe(false));
  });

  describe("isBoundedPositiveNumber", () => {
    it("should return true for 0", () => expect(isBoundedPositiveNumber(0)).toBe(true));
    it("should return true for positive integer", () =>
      expect(isBoundedPositiveNumber(42)).toBe(true));
    it("should return false for negative number", () =>
      expect(isBoundedPositiveNumber(-1)).toBe(false));
    it("should return false for NaN", () => expect(isBoundedPositiveNumber(NaN)).toBe(false));
    it("should return false for Infinity", () =>
      expect(isBoundedPositiveNumber(Infinity)).toBe(false));
    it("should return false for float", () => expect(isBoundedPositiveNumber(1.5)).toBe(false));
    it("should return false for string", () => expect(isBoundedPositiveNumber("5")).toBe(false));
    it("should return false for number exceeding max", () => {
      expect(isBoundedPositiveNumber(10_000_001)).toBe(false);
    });
  });

  describe("isBoundedString", () => {
    it("should return true for a normal string", () => expect(isBoundedString("hello")).toBe(true));
    it("should return false for empty string", () => expect(isBoundedString("")).toBe(false));
    it("should return false for null", () => expect(isBoundedString(null)).toBe(false));
    it("should return false for undefined", () => expect(isBoundedString(undefined)).toBe(false));
    it("should return false for number", () => expect(isBoundedString(42)).toBe(false));
    it("should return false for string exceeding max length", () => {
      expect(isBoundedString("a".repeat(BOUNDED_STRING_MAX_LENGTH + 1))).toBe(false);
    });
    it("should return true for string at max length", () => {
      expect(isBoundedString("a".repeat(BOUNDED_STRING_MAX_LENGTH))).toBe(true);
    });
  });

  describe("isBoundedStringOrNull", () => {
    it("should return true for valid string", () =>
      expect(isBoundedStringOrNull("hello")).toBe(true));
    it("should return true for null", () => expect(isBoundedStringOrNull(null)).toBe(true));
    it("should return true for undefined (null-ish)", () =>
      expect(isBoundedStringOrNull(undefined)).toBe(true));
    it("should return false for empty string", () => expect(isBoundedStringOrNull("")).toBe(false));
    it("should return false for number", () => expect(isBoundedStringOrNull(42)).toBe(false));
  });

  describe("isBoundedStringOrUndefined", () => {
    it("should return true for valid string", () =>
      expect(isBoundedStringOrUndefined("hello")).toBe(true));
    it("should return true for undefined", () =>
      expect(isBoundedStringOrUndefined(undefined)).toBe(true));
    it("should return false for null", () => expect(isBoundedStringOrUndefined(null)).toBe(false));
    it("should return false for empty string", () =>
      expect(isBoundedStringOrUndefined("")).toBe(false));
    it("should return false for number", () => expect(isBoundedStringOrUndefined(42)).toBe(false));
  });

  describe("isBooleanRecord", () => {
    it("should return true for valid Record<string, boolean>", () => {
      expect(isBooleanRecord({ a: true, b: false })).toBe(true);
    });
    it("should return true for empty object", () => expect(isBooleanRecord({})).toBe(true));
    it("should return false for object with non-boolean values", () => {
      expect(isBooleanRecord({ a: "true" })).toBe(false);
    });
    it("should return false for array", () => expect(isBooleanRecord([true])).toBe(false));
    it("should return false for null", () => expect(isBooleanRecord(null)).toBe(false));
  });

  describe("isDate", () => {
    it("should return true for a valid Date", () => expect(isDate(new Date())).toBe(true));
    it("should return false for an invalid Date", () =>
      expect(isDate(new Date("invalid"))).toBe(false));
    it("should return false for a date string", () => expect(isDate("2024-01-01")).toBe(false));
    it("should return false for null", () => expect(isDate(null)).toBe(false));
  });

  describe("isDateOrNull", () => {
    it("should return true for a valid Date", () => expect(isDateOrNull(new Date())).toBe(true));
    it("should return true for null", () => expect(isDateOrNull(null)).toBe(true));
    it("should return false for undefined", () => expect(isDateOrNull(undefined)).toBe(false));
    it("should return false for a date string", () =>
      expect(isDateOrNull("2024-01-01")).toBe(false));
  });

  describe("isDateString", () => {
    it("should return true for ISO date string", () => {
      expect(isDateString("2024-01-15T10:30:00.000Z")).toBe(true);
    });
    it("should return true for simple date string", () => {
      expect(isDateString("2024-01-01")).toBe(true);
    });
    it("should return false for invalid date string", () => {
      expect(isDateString("not-a-date")).toBe(false);
    });
    it("should return false for null", () => expect(isDateString(null)).toBe(false));
    it("should return false for Date object", () => expect(isDateString(new Date())).toBe(false));
  });

  describe("isDateStringOrNull", () => {
    it("should return true for valid date string", () => {
      expect(isDateStringOrNull("2024-01-01")).toBe(true);
    });
    it("should return true for null", () => expect(isDateStringOrNull(null)).toBe(true));
    it("should return false for undefined", () =>
      expect(isDateStringOrNull(undefined)).toBe(false));
    it("should return false for invalid string", () => {
      expect(isDateStringOrNull("not-a-date")).toBe(false);
    });
  });

  describe("isDateStringOrUndefined", () => {
    it("should return true for valid date string", () => {
      expect(isDateStringOrUndefined("2024-01-15T10:30:00.000Z")).toBe(true);
    });
    it("should return true for undefined", () => {
      expect(isDateStringOrUndefined(undefined)).toBe(true);
    });
    it("should return false for null", () => expect(isDateStringOrUndefined(null)).toBe(false));
    it("should return false for invalid string", () => {
      expect(isDateStringOrUndefined("not-a-date")).toBe(false);
    });
    it("should return false for Date object", () => {
      expect(isDateStringOrUndefined(new Date())).toBe(false);
    });
  });

  describe("isBoundedArray", () => {
    it("should return true for an empty array", () => expect(isBoundedArray([])).toBe(true));
    it("should return true for a small array", () => expect(isBoundedArray([1, 2, 3])).toBe(true));
    it("should return false for a non-array", () => expect(isBoundedArray("array")).toBe(false));
    it("should return false for array exceeding max length", () => {
      const oversized = new Array(BOUNDED_ARRAY_MAX_LENGTH + 1);
      expect(isBoundedArray(oversized)).toBe(false);
    });
  });

  describe("createBoundedArrayGuard", () => {
    const isNumberArray = createBoundedArrayGuard(
      (v: unknown): v is number => typeof v === "number",
    );

    it("should return true for an array of valid items", () => {
      expect(isNumberArray([1, 2, 3])).toBe(true);
    });
    it("should return true for an empty array", () => expect(isNumberArray([])).toBe(true));
    it("should return false if any item fails the guard", () => {
      expect(isNumberArray([1, "two", 3])).toBe(false);
    });
    it("should return false for a non-array", () => expect(isNumberArray("not-array")).toBe(false));
  });

  describe("createValidator", () => {
    interface TestModel {
      id: string;
      label: string | null;
      tag?: string;
    }

    const isTestModel = createValidator<TestModel>({
      id: isBoundedString,
      label: isBoundedStringOrNull,
      tag: isBoundedStringOrUndefined,
    });

    it("should return true for a valid object with all fields present", () => {
      expect(isTestModel({ id: "abc", label: "name", tag: "optional" })).toBe(true);
    });

    it("should return true when optional field key is absent from object", () => {
      expect(isTestModel({ id: "abc", label: null })).toBe(true);
    });

    it("should return false when required field is missing", () => {
      expect(isTestModel({ label: "name" })).toBe(false);
    });

    it("should return false when required field fails its guard", () => {
      expect(isTestModel({ id: "", label: "name" })).toBe(false);
    });

    it("should return false for null", () => expect(isTestModel(null)).toBe(false));
    it("should return false for array", () => expect(isTestModel([])).toBe(false));
    it("should return false for string", () => expect(isTestModel("string")).toBe(false));

    it("should return false for class instances (non-plain-object)", () => {
      class Foo {
        id = "abc";
        label = "name";
      }
      expect(isTestModel(new Foo())).toBe(false);
    });

    it("should return false for prototype pollution via __proto__", () => {
      const obj = { id: "abc", label: "name", __proto__: { polluted: true } };
      expect(isTestModel(obj)).toBe(false);
    });

    it("should return false for prototype pollution via constructor property", () => {
      const obj = Object.create(null) as Record<string, unknown>;
      obj["id"] = "abc";
      obj["label"] = "name";
      // Object.create(null) has no prototype — getPrototypeOf returns null ≠ Object.prototype
      expect(isTestModel(obj)).toBe(false);
    });
  });

  describe("createValidator — EnhancedGuard (.explain())", () => {
    interface TestModel {
      id: string;
      label: string | null;
      tag?: string;
    }

    const isTestModel = createValidator<TestModel>({
      id: isBoundedString,
      label: isBoundedStringOrNull,
      tag: isBoundedStringOrUndefined,
    });

    describe("structural failures", () => {
      it("should return a structural error for null", () => {
        const result = isTestModel.explain(null);
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("expected plain object");
        expect(result[0]).toContain("null");
      });

      it("should return a structural error for an array", () => {
        const result = isTestModel.explain([]);
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("expected plain object");
        expect(result[0]).toContain("Array(0)");
      });

      it("should return a structural error for a string", () => {
        const result = isTestModel.explain("hello");
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("expected plain object");
        expect(result[0]).toContain("string");
      });

      it("should return a prototype pollution error for a class instance", () => {
        class Foo {
          id = "abc";
          label = "name";
        }
        const result = isTestModel.explain(new Foo());
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("non-plain object");
      });

      it("should return a prototype pollution error for Object.create(null)", () => {
        const obj = Object.create(null) as Record<string, unknown>;
        obj["id"] = "abc";
        obj["label"] = "name";
        const result = isTestModel.explain(obj);
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("non-plain object");
      });

      it("should return a prototype pollution error for __proto__ key", () => {
        const obj = JSON.parse(
          '{"id":"abc","label":"name","__proto__":{"polluted":true}}',
        ) as unknown;
        const result = isTestModel.explain(obj);
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("prototype pollution");
      });
    });

    describe("field-level failures", () => {
      it("should return empty array for a valid object", () => {
        expect(isTestModel.explain({ id: "abc", label: "name", tag: "opt" })).toHaveLength(0);
      });

      it("should return empty array when optional field is absent", () => {
        expect(isTestModel.explain({ id: "abc", label: null })).toHaveLength(0);
      });

      it("should identify a single failing required field", () => {
        const result = isTestModel.explain({ id: "", label: "name" });
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("field 'id'");
        expect(result[0]).toContain("isBoundedString");
      });

      it("should identify multiple failing fields", () => {
        const result = isTestModel.explain({ id: "", label: 42 });
        expect(result).toHaveLength(2);
        expect(result.some((m) => m.includes("field 'id'"))).toBe(true);
        expect(result.some((m) => m.includes("field 'label'"))).toBe(true);
      });

      it("should report undefined for a missing required field", () => {
        const result = isTestModel.explain({ label: "name" });
        expect(result).toHaveLength(1);
        expect(result[0]).toContain("field 'id'");
        expect(result[0]).toContain("undefined");
      });

      it("should include the guard function name in the message", () => {
        const result = isTestModel.explain({ id: null, label: "name" });
        expect(result[0]).toContain("isBoundedString");
      });

      it("should describe the received type, not the actual value", () => {
        const result = isTestModel.explain({ id: 42, label: "name" });
        expect(result[0]).toContain("number");
        // Should NOT include the actual numeric value as a data point
        expect(result[0]).not.toContain("42");
      });
    });
  });
});
