/**
 * Content-safe validator combinators.
 *
 * Zero runtime dependencies — must remain importable from content scripts (see
 * `apps/browser/.claude/rules/autofill-content-scripts.md` and the architectural
 * invariants in personal/IMPL-extension-messaging-framework.md §2.3).
 *
 * The whole module reaches inbound message payloads, which are fully
 * attacker-controlled. Bad input never throws — failures return `{ ok: false }`.
 * Throws are reserved for programmer errors (a schema author building an invalid
 * combinator). `v.object` iterates the *schema's* keys (never the input's) and
 * checks each via `Object.prototype.hasOwnProperty.call` to neutralize
 * `__proto__` / `constructor` pollution payloads. (We avoid `Object.hasOwn`
 * since the repo's tsconfig targets ES2016/lib es2021.)
 */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Validator<T> {
  parse(input: unknown): Result<T>;
}

export type inferType<V extends Validator<any>> = V extends Validator<infer T> ? T : never;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = (error: string): Result<never> => ({ ok: false, error });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StringOpts {
  min?: number;
  max?: number;
  pattern?: RegExp;
}

interface NumberOpts {
  min?: number;
  max?: number;
  int?: boolean;
}

interface ArrayOpts {
  min?: number;
  max?: number;
}

const string = (opts: StringOpts = {}): Validator<string> => ({
  parse(input) {
    if (typeof input !== "string") {
      return err("expected string");
    }
    if (opts.min !== undefined && input.length < opts.min) {
      return err(`string length below min ${opts.min}`);
    }
    if (opts.max !== undefined && input.length > opts.max) {
      return err(`string length above max ${opts.max}`);
    }
    if (opts.pattern !== undefined && !opts.pattern.test(input)) {
      return err("string did not match pattern");
    }
    return ok(input);
  },
});

const number = (opts: NumberOpts = {}): Validator<number> => ({
  parse(input) {
    if (typeof input !== "number" || !Number.isFinite(input)) {
      return err("expected finite number");
    }
    if (opts.int && !Number.isInteger(input)) {
      return err("expected integer");
    }
    if (opts.min !== undefined && input < opts.min) {
      return err(`number below min ${opts.min}`);
    }
    if (opts.max !== undefined && input > opts.max) {
      return err(`number above max ${opts.max}`);
    }
    return ok(input);
  },
});

const boolean = (): Validator<boolean> => ({
  parse(input) {
    return typeof input === "boolean" ? ok(input) : err("expected boolean");
  },
});

const literal = <L extends string | number | boolean>(value: L): Validator<L> => ({
  parse(input) {
    return input === value ? ok(value) : err(`expected literal ${String(value)}`);
  },
});

const uuid = (): Validator<string> => ({
  parse(input) {
    if (typeof input !== "string") {
      return err("expected string");
    }
    return UUID_RE.test(input) ? ok(input) : err("expected uuid");
  },
});

const enumValidator = <E extends readonly string[]>(values: E): Validator<E[number]> => ({
  parse(input) {
    if (typeof input !== "string") {
      return err("expected string");
    }
    return (values as readonly string[]).includes(input)
      ? ok(input as E[number])
      : err("expected one of enum members");
  },
});

const object = <S extends Record<string, Validator<any>>>(
  schema: S,
): Validator<{ [K in keyof S]: S[K] extends Validator<infer U> ? U : never }> => {
  // Snapshot schema keys at definition time. Iterating the schema (not the input)
  // is what makes object validation prototype-pollution safe.
  const schemaKeys = Object.keys(schema);
  return {
    parse(input) {
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return err("expected object");
      }
      const src = input as Record<string, unknown>;
      const out: Record<string, unknown> = Object.create(null);
      for (const key of schemaKeys) {
        const child = schema[key];
        const value = Object.prototype.hasOwnProperty.call(src, key) ? src[key] : undefined;
        const parsed = child.parse(value);
        if (!parsed.ok) {
          return err(`${key}: ${parsed.error}`);
        }
        if (parsed.value !== undefined) {
          out[key] = parsed.value;
        }
      }
      // Reject extra (own) keys the schema does not declare. Walk only own keys —
      // `for…in` would surface inherited (potentially polluted) properties.
      for (const key of Object.keys(src)) {
        if (!Object.hasOwn(schema, key)) {
          return err(`unknown key: ${key}`);
        }
      }
      return ok(out as { [K in keyof S]: S[K] extends Validator<infer U> ? U : never });
    },
  };
};

const array = <U>(item: Validator<U>, opts: ArrayOpts = {}): Validator<U[]> => ({
  parse(input) {
    if (!Array.isArray(input)) {
      return err("expected array");
    }
    if (opts.min !== undefined && input.length < opts.min) {
      return err(`array length below min ${opts.min}`);
    }
    if (opts.max !== undefined && input.length > opts.max) {
      return err(`array length above max ${opts.max}`);
    }
    const out: U[] = [];
    for (let i = 0; i < input.length; i++) {
      const parsed = item.parse(input[i]);
      if (!parsed.ok) {
        return err(`[${i}]: ${parsed.error}`);
      }
      out.push(parsed.value);
    }
    return ok(out);
  },
});

const optional = <U>(inner: Validator<U>): Validator<U | undefined> => ({
  parse(input) {
    if (input === undefined) {
      return ok(undefined);
    }
    return inner.parse(input);
  },
});

const union = <U extends readonly Validator<any>[]>(
  ...members: U
): Validator<U[number] extends Validator<infer X> ? X : never> => ({
  parse(input) {
    const errors: string[] = [];
    for (const member of members) {
      const parsed = member.parse(input);
      if (parsed.ok) {
        return parsed as Result<U[number] extends Validator<infer X> ? X : never>;
      }
      errors.push(parsed.error);
    }
    return err(`no union member matched: ${errors.join(" | ")}`);
  },
});

export const v = {
  string,
  number,
  boolean,
  literal,
  uuid,
  enum: enumValidator,
  object,
  array,
  optional,
  union,
};
