/**
 * include structuredClone in test environment.
 * @jest-environment ../../../../shared/test.environment.ts
 */

import { of, firstValueFrom } from "rxjs";

import { reduceCollection } from "./reduce-collection.operator";

describe("reduceCollection", () => {
  it.each([[null], [undefined], [[]]])(
    "should return the default value when the collection is %p",
    async (value: number[]) => {
      const reduce = (acc: number, value: number) => acc + value;
      const source$ = of(value);

      const result$ = source$.pipe(reduceCollection(reduce, 100));
      const result = await firstValueFrom(result$);

      expect(result).toEqual(100);
    },
  );

  it("should reduce the collection to a single value", async () => {
    const reduce = (acc: number, value: number) => acc + value;
    const source$ = of([1, 2, 3]);

    const result$ = source$.pipe(reduceCollection(reduce, 0));
    const result = await firstValueFrom(result$);

    expect(result).toEqual(6);
  });
});
