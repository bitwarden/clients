import { safeStringify } from "./safe-stringify";

describe("safeStringify", () => {
  it("returns an empty string for undefined", () => {
    expect(safeStringify(undefined)).toBe("");
  });

  it.each([
    ["a string", "a string"],
    [42, "42"],
    [0, "0"],
    [true, "true"],
    [false, "false"],
    [null, "null"],
    [BigInt(10), "10"],
  ])("stringifies primitive %p", (value, expected) => {
    expect(safeStringify(value)).toBe(expected);
  });

  it("uses the stack for an Error when available", () => {
    const error = new Error("boom");
    error.stack = "Error: boom\n    at somewhere";

    expect(safeStringify(error)).toBe("Error: boom\n    at somewhere");
  });

  it("falls back to name and message when an Error has no stack", () => {
    const error = new TypeError("bad type");
    error.stack = undefined;

    expect(safeStringify(error)).toBe("TypeError: bad type");
  });

  it("falls back to name and message when an Error has a blank stack", () => {
    const error = new TypeError("bad type");
    error.stack = "";

    expect(safeStringify(error)).toBe("TypeError: bad type");
  });

  it("caps the frames of a deep stack", () => {
    const error = new Error("boom");
    const frames = Array.from({ length: 50 }, (_, i) => `    at frame${i} (main.js:${i}:1)`);
    error.stack = ["Error: boom", ...frames].join("\n");

    const result = safeStringify(error);

    expect(result).toHaveLength("Error: boom".length + 200);
    expect(result.startsWith("Error: boom\n    at frame0")).toBe(true);
  });

  it("keeps the whole message when it is longer than the frame cap", () => {
    const message = "x".repeat(300);
    const error = new Error(message);
    error.stack = `Error: ${message}\n    at run (app.js:1:1)`;

    const result = safeStringify(error);

    expect(result).toContain(message);
    expect(result).toContain("at run (app.js:1:1)");
  });

  it("leaves a stack within the cap untouched", () => {
    const error = new Error("boom");
    error.stack = ["Error: boom", "    at a (main.js:1:1)", "    at b (main.js:2:1)"].join("\n");

    expect(safeStringify(error)).toBe(error.stack);
  });

  it("returns an empty string for an empty string, like undefined", () => {
    // Callers that drop empty results drop both. Deliberate: an empty message
    // carries nothing worth a buffer slot.
    expect(safeStringify("")).toBe("");
  });

  it("stringifies a symbol rather than interpolating it", () => {
    // String() rather than a template literal, which throws on symbols.
    expect(safeStringify(Symbol("tag"))).toBe("Symbol(tag)");
  });

  it("stringifies a function to its source", () => {
    expect(safeStringify(function myFn() {})).toContain("myFn");
  });

  it("serializes plain objects with JSON.stringify", () => {
    expect(safeStringify({ user: "abc", count: 3 })).toBe('{"user":"abc","count":3}');
  });

  it("serializes arrays with JSON.stringify", () => {
    expect(safeStringify([1, "two", true])).toBe('[1,"two",true]');
  });

  it("prefixes a class instance with its constructor name", () => {
    class Session {
      constructor(
        readonly userId: string,
        readonly active: boolean,
      ) {}
    }

    expect(safeStringify(new Session("abc", true))).toBe('Session {"userId":"abc","active":true}');
  });

  it("does not prefix an object with no constructor", () => {
    expect(safeStringify(Object.create(null))).toBe("{}");
  });

  it("does not prefix a class instance nested inside another object", () => {
    class Inner {
      a = 1;
    }

    expect(safeStringify({ inner: new Inner() })).toBe('{"inner":{"a":1}}');
  });

  it("unwraps a nested Error, which JSON.stringify renders as {}", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n    at save (main.js:12:20)";

    expect(safeStringify({ context: "save", err })).toBe(
      '{"context":"save","err":"Error: boom\\n    at save (main.js:12:20)"}',
    );
  });

  it("unwraps an Error nested in an array", () => {
    const err = new TypeError("bad type");
    err.stack = undefined;

    expect(safeStringify([err])).toBe('["TypeError: bad type"]');
  });

  it.each([
    ["V8, which repeats it", "Error: boom\n    at save (main.js:12:20)"],
    ["WebKit, which does not", "save@main.js:12:20"],
  ])("keeps name and message for a stack from %s", (_engine, stack) => {
    const err = new Error("boom");
    err.stack = stack;

    const result = safeStringify(err);

    expect(result.startsWith("Error: boom")).toBe(true);
    expect(result).toContain("main.js:12:20");
  });

  it("renders an Error identically at the root and nested", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n    at save (main.js:12:20)";

    expect(safeStringify({ err })).toBe(`{"err":${JSON.stringify(safeStringify(err))}}`);
  });

  it("unwraps a nested Map and Set, which JSON.stringify renders as {}", () => {
    const value = { cache: new Map([["k", "v"]]), seen: new Set([1, 2]) };

    expect(safeStringify(value)).toBe('{"cache":{"k":"v"},"seen":[1,2]}');
  });

  it.each([
    [new Map([["k", "v"]]), 'Map {"k":"v"}'],
    [new Set([1, 2]), "Set [1,2]"],
  ])("renders a top-level %p with its type", (value, expected) => {
    expect(safeStringify(value)).toBe(expected);
  });

  it("falls back to the default tag when serialization throws on a circular reference", () => {
    const circular: any = {};
    circular.self = circular;

    expect(safeStringify(circular)).toBe("[object Object]");
  });

  it("falls back to the default tag when a getter throws during serialization", () => {
    const value = {
      get bad(): never {
        throw new Error("getter blew up");
      },
    };

    expect(safeStringify(value)).toBe("[object Object]");
  });

  it("falls back to the default tag when toJSON throws", () => {
    const value = {
      toJSON(): never {
        throw new Error("nope");
      },
    };

    expect(safeStringify(value)).toBe("[object Object]");
  });

  it("unwraps a nested BigInt rather than losing the whole object", () => {
    // JSON.stringify throws on BigInt, which would cost us every other field.
    expect(safeStringify({ n: BigInt(1), kept: "yes" })).toBe('{"n":"1","kept":"yes"}');
  });

  it.each([
    ["Uint8Array(32)", new Uint8Array(32)],
    ["Uint16Array(8)", new Uint16Array(4)],
    ["DataView(8)", new DataView(new ArrayBuffer(8))],
    ["ArrayBuffer(16)", new ArrayBuffer(16)],
  ])("reduces a nested buffer to %s, never its contents", (expected, value) => {
    expect(safeStringify({ key: value })).toBe(`{"key":"${expected}"}`);
  });

  it.each([
    ["Uint8Array(32)", new Uint8Array(32)],
    ["ArrayBuffer(8)", new ArrayBuffer(8)],
  ])("renders a top-level buffer as bare %s, unquoted and unprefixed", (expected, value) => {
    expect(safeStringify(value)).toBe(expected);
  });

  it("does not put buffer contents in the output", () => {
    const secret = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

    const result = safeStringify({ key: secret });

    expect(result).toBe('{"key":"Uint8Array(4)"}');
    expect(result).not.toContain("222");
    expect(result).not.toContain("dead");
  });

  it("reduces a Buffer, whose toJSON would otherwise expose every byte", () => {
    const secret = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

    const result = safeStringify({ key: secret });

    expect(result).toBe('{"key":"Buffer(4)"}');
    expect(result).not.toContain("222");
  });

  it.each([
    ["an array", (b: Buffer) => [b]],
    ["a Map value", (b: Buffer) => ({ m: new Map([["k", b]]) })],
    ["a deeply nested object", (b: Buffer) => ({ a: { b: { c: b } } })],
  ])("reduces a Buffer inside %s", (_shape, wrap) => {
    const result = safeStringify(wrap(Buffer.from([0xde, 0xad])));

    expect(result).toContain("Buffer(2)");
    expect(result).not.toContain("222");
  });

  it("keeps a useful toJSON, which the buffer lookup must not bypass", () => {
    const value = { at: new Date("2026-08-12T10:00:00Z") };

    expect(safeStringify(value)).toBe('{"at":"2026-08-12T10:00:00.000Z"}');
  });

  it("does not throw for a self-referencing Map", () => {
    const map = new Map<string, unknown>();
    map.set("self", map);

    expect(safeStringify(map)).toBe("[object Map]");
  });

  it("falls back to the default tag when toJSON yields undefined", () => {
    expect(safeStringify({ toJSON: (): undefined => undefined })).toBe("[object Object]");
  });

  it("does not throw for a value with no usable toString", () => {
    const circular: any = Object.create(null);
    circular.self = circular;

    expect(safeStringify(circular)).toBe("[object Object]");
  });
});
