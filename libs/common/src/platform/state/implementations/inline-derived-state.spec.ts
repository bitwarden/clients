import { Subject, firstValueFrom } from "rxjs";

import { DeriveDefinition } from "../derive-definition";
import { StateDefinition } from "../state-definition";

import { InlineDerivedState } from "./inline-derived-state";

describe("InlineDerivedState", () => {
  const syncDeriveDefinition = new DeriveDefinition<boolean, boolean, Record<string, unknown>>(
    new StateDefinition("test", "disk"),
    "test",
    {
      derive: (value, deps) => !value,
      deserializer: (value) => value,
    },
  );

  const asyncDeriveDefinition = new DeriveDefinition<boolean, boolean, Record<string, unknown>>(
    new StateDefinition("test", "disk"),
    "test",
    {
      derive: async (value, deps) => Promise.resolve(!value),
      deserializer: (value) => value,
    },
  );

  const parentState = new Subject<boolean>();

  describe("state", () => {
    const cases = [
      {
        it: "works when derive function is sync",
        definition: syncDeriveDefinition,
      },
      {
        it: "works when derive function is async",
        definition: asyncDeriveDefinition,
      },
    ];

    it.each(cases)("$it", async ({ definition }) => {
      const sut = new InlineDerivedState(parentState.asObservable(), definition, {});

      const valuePromise = firstValueFrom(sut.state$);
      parentState.next(true);

      const value = await valuePromise;

      expect(value).toBe(false);
    });
  });

  describe("forceValue", () => {
    it("returns the force value back to the caller", async () => {
      const sut = new InlineDerivedState(parentState.asObservable(), syncDeriveDefinition, {});

      const value = await sut.forceValue(true);

      expect(value).toBe(true);
    });
  });
});
