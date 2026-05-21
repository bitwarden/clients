import { v, inferType, Validator } from "./validators";

describe("validators", () => {
  describe("v.string", () => {
    it("accepts strings", () => {
      expect(v.string().parse("hi")).toEqual({ ok: true, value: "hi" });
    });

    it("rejects non-strings", () => {
      expect(v.string().parse(1)).toEqual({ ok: false, error: expect.any(String) });
      expect(v.string().parse(null)).toEqual({ ok: false, error: expect.any(String) });
    });

    it("enforces min/max length", () => {
      expect(v.string({ min: 2 }).parse("a").ok).toBe(false);
      expect(v.string({ max: 2 }).parse("abc").ok).toBe(false);
      expect(v.string({ min: 1, max: 3 }).parse("ab").ok).toBe(true);
    });

    it("enforces pattern", () => {
      expect(v.string({ pattern: /^\d+$/ }).parse("abc").ok).toBe(false);
      expect(v.string({ pattern: /^\d+$/ }).parse("123").ok).toBe(true);
    });
  });

  describe("v.number", () => {
    it("accepts finite numbers", () => {
      expect(v.number().parse(42).ok).toBe(true);
    });

    it("rejects NaN and Infinity", () => {
      expect(v.number().parse(NaN).ok).toBe(false);
      expect(v.number().parse(Infinity).ok).toBe(false);
      expect(v.number().parse(-Infinity).ok).toBe(false);
    });

    it("enforces int option", () => {
      expect(v.number({ int: true }).parse(1.5).ok).toBe(false);
      expect(v.number({ int: true }).parse(1).ok).toBe(true);
    });

    it("rejects integer-overflow style payloads outside min/max", () => {
      // Number.MAX_SAFE_INTEGER + 1 is representable but no longer distinct from
      // its neighbor; a tabId of 2^53 is nonsense — schema authors set max accordingly.
      const r = v.number({ int: true, min: 0, max: Number.MAX_SAFE_INTEGER });
      expect(r.parse(Number.MAX_SAFE_INTEGER + 100).ok).toBe(false);
    });

    it("rejects non-numbers", () => {
      expect(v.number().parse("1").ok).toBe(false);
      expect(v.number().parse(null).ok).toBe(false);
    });
  });

  describe("v.boolean", () => {
    it("accepts true/false only", () => {
      expect(v.boolean().parse(true).ok).toBe(true);
      expect(v.boolean().parse(false).ok).toBe(true);
      expect(v.boolean().parse("true").ok).toBe(false);
      expect(v.boolean().parse(1).ok).toBe(false);
    });
  });

  describe("v.literal", () => {
    it("accepts the exact literal", () => {
      expect(
        v.literal("fillAutofillInlineMenuCipher").parse("fillAutofillInlineMenuCipher").ok,
      ).toBe(true);
      expect(v.literal("fillAutofillInlineMenuCipher").parse("other").ok).toBe(false);
    });
  });

  describe("v.uuid", () => {
    it("accepts canonical 8-4-4-4-12 hex", () => {
      expect(v.uuid().parse("550e8400-e29b-41d4-a716-446655440000").ok).toBe(true);
    });

    it("rejects XSS payload disguised as UUID", () => {
      // Real attacker probe: stuff a script tag into a field that downstream code
      // might naively render or pass to innerHTML.
      const payload = "<script>alert(1)</script>";
      expect(v.uuid().parse(payload).ok).toBe(false);
    });

    it("rejects partial / malformed uuids", () => {
      expect(v.uuid().parse("not-a-uuid").ok).toBe(false);
      expect(v.uuid().parse("550e8400-e29b-41d4-a716").ok).toBe(false);
      expect(v.uuid().parse("").ok).toBe(false);
    });

    it("is case-insensitive (uppercase hex is valid)", () => {
      expect(v.uuid().parse("550E8400-E29B-41D4-A716-446655440000").ok).toBe(true);
    });
  });

  describe("v.enum", () => {
    it("accepts a declared member", () => {
      const cmd = v.enum(["fill", "save"] as const);
      expect(cmd.parse("fill").ok).toBe(true);
    });

    it("rejects values not in the set", () => {
      const cmd = v.enum(["fill", "save"] as const);
      expect(cmd.parse("delete").ok).toBe(false);
      expect(cmd.parse(1).ok).toBe(false);
    });
  });

  describe("v.object", () => {
    const Person = v.object({
      name: v.string({ max: 32 }),
      age: v.number({ int: true, min: 0 }),
    });

    it("parses a well-formed object", () => {
      const r = Person.parse({ name: "ada", age: 30 });
      expect(r).toEqual({ ok: true, value: { name: "ada", age: 30 } });
    });

    it("reports the failing field", () => {
      const r = Person.parse({ name: "ada", age: -1 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toMatch(/^age:/);
      }
    });

    it("rejects when a required key is missing", () => {
      const r = Person.parse({ name: "ada" });
      expect(r.ok).toBe(false);
    });

    it("rejects unknown keys", () => {
      const r = Person.parse({ name: "ada", age: 30, role: "admin" });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toMatch(/unknown key: role/);
      }
    });

    it("rejects non-objects (array, null, primitives)", () => {
      expect(Person.parse([]).ok).toBe(false);
      expect(Person.parse(null).ok).toBe(false);
      expect(Person.parse("nope").ok).toBe(false);
    });

    it("neutralizes a prototype-pollution payload", () => {
      // The classic: send `__proto__` so a careless merge contaminates Object.prototype.
      // We treat __proto__ as an unknown key — it is not declared in `Person`, so reject.
      const payload = JSON.parse('{"name":"x","age":1,"__proto__":{"isAdmin":true}}');
      const r = Person.parse(payload);
      expect(r.ok).toBe(false);
      // And, critically, no global contamination occurred either way.
      expect(({} as any).isAdmin).toBeUndefined();
    });

    it("returns a null-prototype object so downstream lookups are honest", () => {
      const r = Person.parse({ name: "x", age: 1 });
      if (r.ok) {
        expect(Object.getPrototypeOf(r.value)).toBeNull();
        // "__proto__" on a null-proto object resolves to undefined, not Object.prototype.
        expect((r.value as any).__proto__).toBeUndefined();
      }
    });

    it("strips undefined optional fields rather than materializing them", () => {
      const Schema = v.object({ a: v.string(), b: v.optional(v.string()) });
      const r = Schema.parse({ a: "x" });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect("b" in r.value).toBe(false);
      }
    });
  });

  describe("v.array", () => {
    const ids = v.array(v.uuid(), { min: 1, max: 3 });

    it("accepts a list within bounds", () => {
      const r = ids.parse(["550e8400-e29b-41d4-a716-446655440000"]);
      expect(r.ok).toBe(true);
    });

    it("rejects below min", () => {
      expect(ids.parse([]).ok).toBe(false);
    });

    it("rejects above max", () => {
      const u = "550e8400-e29b-41d4-a716-446655440000";
      expect(ids.parse([u, u, u, u]).ok).toBe(false);
    });

    it("propagates element error with index", () => {
      const r = ids.parse(["bad-id"]);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toMatch(/\[0\]:/);
      }
    });

    it("rejects non-arrays", () => {
      expect(ids.parse("not-an-array").ok).toBe(false);
      expect(ids.parse({ length: 0 }).ok).toBe(false);
    });
  });

  describe("v.optional", () => {
    it("accepts undefined and the inner type", () => {
      const opt = v.optional(v.string());
      expect(opt.parse(undefined).ok).toBe(true);
      expect(opt.parse("x").ok).toBe(true);
    });

    it("still rejects values that don't match the inner type", () => {
      expect(v.optional(v.string()).parse(1).ok).toBe(false);
    });

    it("does NOT accept null (null is a value, not absent)", () => {
      expect(v.optional(v.string()).parse(null).ok).toBe(false);
    });
  });

  describe("v.union", () => {
    const stringOrNumber = v.union(v.string(), v.number());

    it("accepts any member match", () => {
      expect(stringOrNumber.parse("x").ok).toBe(true);
      expect(stringOrNumber.parse(1).ok).toBe(true);
    });

    it("rejects when no member matches and aggregates errors", () => {
      const r = stringOrNumber.parse(true);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toMatch(/no union member matched/);
      }
    });
  });

  describe("invariants", () => {
    it("never throws on hostile input", () => {
      const Schema = v.object({
        tabId: v.number({ int: true, min: 0 }),
        cmd: v.string(),
        ids: v.array(v.uuid()),
      });

      const hostile: unknown[] = [
        undefined,
        null,
        42,
        "string",
        [],
        { tabId: "not-a-number", cmd: "x", ids: [] },
        { tabId: 1, cmd: 1, ids: [] },
        { tabId: 1, cmd: "x", ids: [{ then: () => {} }] },
        JSON.parse('{"__proto__":{"polluted":true},"tabId":1,"cmd":"x","ids":[]}'),
        Object.create({ tabId: 1, cmd: "x", ids: [] }),
      ];

      for (const input of hostile) {
        expect(() => Schema.parse(input)).not.toThrow();
      }
    });

    it("typed inference returns the inferred shape", () => {
      const Schema = v.object({ a: v.string(), n: v.number() });
      type S = inferType<typeof Schema>;
      // Compile-time check: this assignment only succeeds if S = { a: string; n: number }.
      const value: S = { a: "x", n: 1 };
      // Avoid unused-variable lint; round-trip through parse to exercise it at runtime too.
      const r = Schema.parse(value);
      expect(r.ok).toBe(true);
    });

    it("Validator<T> interface is structural — third parties can implement it", () => {
      const custom: Validator<"yes"> = {
        parse(input) {
          return input === "yes" ? { ok: true, value: "yes" } : { ok: false, error: "nope" };
        },
      };
      expect(custom.parse("yes").ok).toBe(true);
      expect(custom.parse("no").ok).toBe(false);
    });
  });
});
