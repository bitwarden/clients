import { of } from "rxjs";

import { ExecutionContextBuilder } from "./execution-context.builder";

describe("ExecutionContextBuilder", () => {
  describe("with", () => {
    it("builds the context with the value returned by the factory when the value is not a promise or observable", async () => {
      const context = await new ExecutionContextBuilder()
        .with(() => 42)
        .as("value")
        .build();

      expect(context).toEqual({ value: 42 });
    });

    it("builds the context with the value resolved by the promise returned by the factory", async () => {
      const context = await new ExecutionContextBuilder()
        .with(() => Promise.resolve(42))
        .as("value")
        .build();

      expect(context).toEqual({ value: 42 });
    });

    it("builds the context with the value resolved by the observable returned by the factory", async () => {
      const context = await new ExecutionContextBuilder()
        .with(() => of(42))
        .as("value")
        .build();

      expect(context).toEqual({ value: 42 });
    });
  });

  describe("multiple with", () => {
    it("builds the context with all the values returned by the factories", async () => {
      const context = await new ExecutionContextBuilder()
        .with(() => 42)
        .as("value")
        .with(() => "foo")
        .as("string")
        .build();

      expect(context).toEqual({ value: 42, string: "foo" });
    });

    it("provides the current context to the factory", async () => {
      const context = await new ExecutionContextBuilder()
        .withValue(42)
        .as("first")
        .with((c) => c.first + 1)
        .as("second")
        .build();

      expect(context).toEqual({ first: 42, second: 43 });
    });

    it("allows overriding the context", async () => {
      const context = await new ExecutionContextBuilder()
        .withValue(42)
        .as("value")
        .withValue(43)
        .as("value")
        .build();

      expect(context).toEqual({ value: 43 });
    });
  });

  describe("withValue", () => {
    it("builds the context with the provided value", async () => {
      const context = await new ExecutionContextBuilder().withValue(42).as("value").build();

      expect(context).toEqual({ value: 42 });
    });
  });

  describe("withFirstValueFrom", () => {
    it("builds the context with the value resolved by the observable", async () => {
      const context = await new ExecutionContextBuilder()
        .withFirstValueFrom(of(42))
        .as("value")
        .build();

      expect(context).toEqual({ value: 42 });
    });
  });
});
