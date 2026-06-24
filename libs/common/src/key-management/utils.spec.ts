import { assertParametersNonNull } from "./utils";

describe("assertParametersNonNull", () => {
  class Example {
    capturedThis: unknown;
    capturedArgs: unknown[] | undefined;

    @assertParametersNonNull()
    method(a: unknown, b: unknown, c: unknown): string {
      this.capturedThis = this;
      this.capturedArgs = [a, b, c];
      return "ok";
    }

    @assertParametersNonNull()
    noArgs(): string {
      return "no-args";
    }
  }

  it("invokes the wrapped method when all arguments are non-nullish", () => {
    const ex = new Example();

    const result = ex.method("a", 0, false);

    expect(result).toBe("ok");
    expect(ex.capturedArgs).toEqual(["a", 0, false]);
  });

  it("preserves the `this` binding of the wrapped method", () => {
    const ex = new Example();

    ex.method("a", "b", "c");

    expect(ex.capturedThis).toBe(ex);
  });

  it("throws when an argument is null", () => {
    const ex = new Example();

    expect(() => ex.method("a", null, "c")).toThrow("parameter 1 is null or undefined.");
  });

  it("throws when an argument is undefined", () => {
    const ex = new Example();

    expect(() => ex.method(undefined, "b", "c")).toThrow("parameter 0 is null or undefined.");
  });

  it("throws on the first nullish argument encountered", () => {
    const ex = new Example();

    expect(() => ex.method(null, undefined, "c")).toThrow("parameter 0 is null or undefined.");
  });

  it("invokes a no-arg method without throwing", () => {
    const ex = new Example();

    expect(ex.noArgs()).toBe("no-args");
  });
});
