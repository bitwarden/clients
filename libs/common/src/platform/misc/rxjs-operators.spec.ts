import { firstValueFrom, of } from "rxjs";

import { getById, getByIds } from "./rxjs-operators";

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
});
