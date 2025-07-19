import { mergeOptions } from "./options";

type ExampleOptions = {
  readonly a?: number;
  readonly required_func: () => void;
  readonly optional_func?: () => void;
  readonly b: string;
  readonly c?: {
    readonly d?: number;
    readonly e: string;
  };
  readonly f: {
    readonly h?: number;
    readonly i: string;
  };
};

const EXAMPLE_DEFAULTS = Object.freeze({
  a: 0,
  optional_func: () => {},
  c: {
    d: 1,
    e: "default",
  },
  f: {
    h: 1,
  },
});

describe("mergeOptions", () => {
  it("merges options with defaults", () => {
    const options: ExampleOptions = {
      required_func: () => {},
      b: "test",
      f: {
        i: "example",
      },
    };

    const merged = mergeOptions(options, EXAMPLE_DEFAULTS);

    // can access properties
    expect(merged.a).toBe(0);
    expect(merged.c.d).toBe(1);

    expect(merged).toEqual({
      a: 0,
      b: "test",
      c: {
        d: 1,
        e: "default",
      },
      f: {
        h: 1,
        i: "example",
      },
      optional_func: EXAMPLE_DEFAULTS.optional_func,
      required_func: options.required_func,
    });
  });

  it("maintains required properties under optional properties", () => {
    const options: ExampleOptions = {
      required_func: () => {},
      b: "test",
      c: {
        e: "custom",
      },
      f: {
        i: "example",
      },
    };

    const merged = mergeOptions(options, EXAMPLE_DEFAULTS);

    expect(merged).toEqual({
      a: 0,
      b: "test",
      c: {
        d: 1, // default value from EXAMPLE_DEFAULTS
        e: "custom", // overridden by options
      },
      f: {
        h: 1, // default value from EXAMPLE_DEFAULTS
        i: "example", // overridden by options
      },
      optional_func: EXAMPLE_DEFAULTS.optional_func,
      required_func: options.required_func,
    });
  });

  it("overrides defaults with options", () => {
    const options: ExampleOptions = {
      a: 42,
      b: "test",
      f: {
        i: "example",
      },
      required_func: () => {},
    };

    const merged = mergeOptions(options, EXAMPLE_DEFAULTS);

    // can access properties
    expect(merged.a).toBe(42);

    expect(merged).toEqual({
      a: 42,
      b: "test",
      c: {
        d: 1,
        e: "default",
      },
      f: {
        h: 1,
        i: "example",
      },
      optional_func: EXAMPLE_DEFAULTS.optional_func,
      required_func: options.required_func,
    });
  });

  //Defaults has a required property 'a', but options does not provide it. Not an error
  mergeOptions({ b: "test" } as { b: string }, { a: 0 });
  //Defaults provides a required function, but options does not provide it. Not an error
  mergeOptions({ b: "test" } as { b: string }, { required_func: () => {} });
  //Defaults provides a required property of the wrong type. Not an error because default will never be used
  mergeOptions({ a: "test" } as { a: string }, { a: 0 });
  //Defaults provides a required function of the wrong type. Not an error because default will never be used
  mergeOptions({ required_func: () => "" } as { required_func: () => string }, {
    required_func: () => {},
  });

  //@ts-expect-error -- Defaults provides an optional property of the wrong type
  mergeOptions({} as { a?: string }, { a: 0 });
  //@ts-expect-error -- Defaults provides an optional function of the wrong type
  mergeOptions({} as { optional_func?: () => string }, { optional_func: () => {} });

  //@ts-expect-error -- defaults missing an property optional in options
  mergeOptions({ a: 42 } as { a?: number }, {});
  //@ts-expect-error -- defaults missing an method optional in options
  mergeOptions({ f: () => {} } as { f?: () => void }, {});

  //@ts-expect-error -- defaults missing a deep optional property defined in options
  mergeOptions({ a: { required_func: () => {} } } as { a?: { required_func: () => void } }, {});
  //@ts-expect-error -- defaults missing a deep optional property defined in options
  mergeOptions({ a: { required_func: () => {} } } as { a: { required_func?: () => void } }, {});

  //@ts-expect-error -- defaults missing a optional object defined in options
  mergeOptions({} as { a?: { b: number } }, {});

  //@ts-expect-error -- defaults missing a deep optional property defined in required option
  mergeOptions({ a: {} } as { a: { b?: number } }, {});

  //@ts-expect-error -- defaults missing a deep optional property defined in optional option
  mergeOptions({ a: {} } as { a?: { b?: number } }, {});
  //@ts-expect-error -- defaults missing a deep optional property defined in optional option
  mergeOptions({ a: {} } as { a?: { b?: number } }, { a: {} });
});
