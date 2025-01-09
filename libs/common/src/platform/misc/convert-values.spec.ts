import { forkJoin, lastValueFrom, of, switchMap } from "rxjs";

import { convertValues } from "./convert-values";

describe("convertValues", () => {
  it("returns null if given null", async () => {
    const output = await lastValueFrom(
      of<Record<string, number>>(null).pipe(convertValues((k, v) => of(v + 1))),
    );

    expect(output).toEqual(null);
  });

  it("returns empty record if given empty record", async () => {
    const output = await lastValueFrom(
      of<Record<string, number>>({}).pipe(convertValues((k, v) => of(v + 1))),
    );

    expect(output).toEqual({});
  });

  const cases: { it: string; input: Record<string, number>; output: Record<string, number> }[] = [
    {
      it: "converts single entry to observable",
      input: {
        one: 1,
      },
      output: {
        one: 2,
      },
    },
    {
      it: "converts multiple entries to observable",
      input: {
        one: 1,
        two: 2,
        three: 3,
      },
      output: {
        one: 2,
        two: 3,
        three: 4,
      },
    },
  ];

  it.each(cases)("$it", async ({ input, output: expectedOutput }) => {
    const output = await lastValueFrom(
      of(input).pipe(
        convertValues((key, value) => of(value + 1)),
        switchMap((values) => forkJoin(values)),
      ),
    );

    expect(output).toEqual(expectedOutput);
  });

  it("converts async functions to observable", async () => {
    const output = await lastValueFrom(
      of({
        one: 1,
        two: 2,
      }).pipe(
        convertValues(async (key, value) => await Promise.resolve(value + 1)),
        switchMap((values) => forkJoin(values)),
      ),
    );

    expect(output).toEqual({
      one: 2,
      two: 3,
    });
  });
});
