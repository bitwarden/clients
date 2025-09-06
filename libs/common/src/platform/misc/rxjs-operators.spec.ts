import { firstValueFrom, of } from "rxjs";

import { getById, getByIds, isNotNullish } from "./rxjs-operators";

describe("custom rxjs operators", () => {
  describe("getById", () => {
    it("returns an object with a matching id", async () => {
      const obs = of([
        {
          id: 1,
          data: "one",
        },
        {
          id: 2,
          data: "two",
        },
        {
          id: 3,
          data: "three",
        },
      ]).pipe(getById(2));

      const result = await firstValueFrom(obs);

      expect(result).toEqual({ id: 2, data: "two" });
    });
  });

  describe("getByIds", () => {
    it("returns an array of objects with matching ids", async () => {
      const obs = of([
        {
          id: 1,
          data: "one",
        },
        {
          id: 2,
          data: "two",
        },
        {
          id: 3,
          data: "three",
        },
        {
          id: 4,
          data: "four",
        },
      ]).pipe(getByIds([2, 3]));

      const result = await firstValueFrom(obs);

      expect(result).toEqual([
        { id: 2, data: "two" },
        { id: 3, data: "three" },
      ]);
    });
  });

  describe("isNotNullish", () => {
    test.each([
      ["string", "abc"],
      ["number", 42],
      ["zero", 0],
      ["false", false],
      ["true", true],
      ["object", {}],
      ["array", []],
      ["empty string", ""],
    ])("returns true for %s", (_, value) => {
      expect(isNotNullish(value)).toBe(true);
    });

    test.each([
      ["null", null],
      ["undefined", undefined],
    ])("returns false for %s", (_, value) => {
      expect(isNotNullish(value)).toBe(false);
    });

    it("acts as type guard narrowing union types", () => {
      const value: string | null | undefined = "test";
      if (isNotNullish(value)) {
        // TypeScript should recognize value as string here
        expect(value.length).toBe(4);
      }

      if (!isNotNullish(value)) {
        // @ts-expect-error - should not be able to access property on never type
        expect(value.length).toBeUndefined();
      }
    });
  });
});
