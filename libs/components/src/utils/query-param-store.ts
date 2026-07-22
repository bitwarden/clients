import { Signal, WritableSignal, effect, inject, linkedSignal, signal } from "@angular/core";
import { ActivatedRoute, ParamMap, Params, Router } from "@angular/router";

/** A URL-encodable scalar. */
export type ParamScalar = string | number | boolean;

/** A value the store syncs to the URL: a scalar, a list of scalars, or absent. */
export type ParamValue = ParamScalar | readonly ParamScalar[] | undefined;

/**
 * The shape a {@link queryParamStore} holds — a flat record of URL-encodable
 * values. Each property maps to one query param under the store's namespace.
 */
export type ParamState = Record<string, ParamValue>;

/** Encodes a single scalar for the URL. */
function encodeScalar(value: ParamScalar): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

/**
 * Decodes a single param string back by shape: `"true"`/`"false"` → boolean, an
 * integer-looking string → number, otherwise the string. Lossy at the edges (a
 * literal `"true"`, a numeric-string id), the trade for readable URLs without
 * per-value type metadata.
 */
function decodeScalar(raw: string): ParamScalar {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (/^-?\d+$/.test(raw)) {
    const num = Number(raw);
    if (Number.isSafeInteger(num)) {
      return num;
    }
  }
  return raw;
}

/**
 * Encodes one value to a param (or `null` to omit it). Arrays become a repeated
 * key; empties (`null`/`undefined`/`""`/`[]`) drop out, so a key set to an empty
 * value leaves no param behind.
 */
export function encodeParamValue(value: ParamValue): string | string[] | null {
  if (value == null || value === "") {
    return null;
  }
  if (Array.isArray(value)) {
    const encoded = value
      .filter((item) => item != null && item !== "")
      .map((item) => encodeScalar(item));
    return encoded.length > 0 ? encoded : null;
  }
  return encodeScalar(value as ParamScalar);
}

/** Decodes the raw param(s) for one key: repeated keys → array, else a scalar. */
export function decodeParam(raw: readonly string[]): ParamValue {
  if (raw.length > 1) {
    return raw.map(decodeScalar);
  }
  return decodeScalar(raw[0]);
}

/** Reads every `<namespace>.*` param into a flat state record (keys un-prefixed). */
export function decodeNamespace(params: ParamMap, namespace: string): ParamState {
  const prefix = `${namespace}.`;
  const state: ParamState = {};
  for (const fullKey of params.keys) {
    if (fullKey.startsWith(prefix)) {
      state[fullKey.slice(prefix.length)] = decodeParam(params.getAll(fullKey));
    }
  }
  return state;
}

/** Builds a namespaced query-param patch from a state record (`null` removes a key). */
export function encodeNamespace(namespace: string, state: ParamState): Params {
  const patch: Record<string, string | string[] | null> = {};
  for (const [key, value] of Object.entries(state)) {
    patch[`${namespace}.${key}`] = encodeParamValue(value);
  }
  return patch;
}

/**
 * A writable signal mirrored to the URL query string under `namespace`. Its value
 * is seeded from the current URL (merged over `initial`), and every `.set`/`.update`
 * writes back with `merge` + `replaceUrl` — params under other namespaces are left
 * untouched, history stays flat. Each property of the value maps to one
 * `namespace.key` param; an empty value omits its param, so clearing a key removes it.
 *
 * `namespace` may be a `Signal` (e.g. a component input), so the store can be created
 * in a field initializer before the input resolves: seeding uses {@link linkedSignal},
 * which decodes the URL lazily the first time the value is read — by which point the
 * namespace is available — rather than in an effect that would race the reader.
 *
 * Must be created in an injection context (it injects the router); without a router
 * in context it degrades to a plain signal (no URL sync). Values are typed to
 * {@link ParamState} so the built-in codec can round-trip them — no custom serialization.
 *
 * @example
 * ```ts
 * readonly filters = queryParamStore<{ type?: string; favorite?: boolean }>("vault");
 * this.filters.set({ type: "login", favorite: true }); // ?vault.type=login&vault.favorite=true
 * ```
 */
export function queryParamStore<T extends ParamState>(
  namespace: string | Signal<string | undefined>,
  initial?: T,
): WritableSignal<T> {
  const router = inject(Router, { optional: true });
  const route = inject(ActivatedRoute, { optional: true });
  const name: Signal<string | undefined> =
    typeof namespace === "string" ? signal(namespace) : namespace;

  // Seed from the URL lazily off `name`: `linkedSignal` computes on read (when the
  // namespace has resolved), not in an effect, so no reader can outrace the seed.
  // `.set`/`.update` then hold until `name` changes (it won't, for a stable input).
  const state = linkedSignal<T>(() => {
    const ns = name();
    if (ns == null) {
      return (initial ?? {}) as T;
    }
    const fromUrl = router ? decodeNamespace(router.parseUrl(router.url).queryParamMap, ns) : {};
    return { ...(initial ?? {}), ...fromUrl } as T;
  });

  if (router && route) {
    effect(() => {
      const ns = name();
      const value = state();
      if (ns == null) {
        return;
      }
      // Navigate only when the URL doesn't already reflect the value — so the
      // initial seed (and any no-op set) writes nothing. Comparing against the
      // live URL is timing-independent, unlike tracking a "first run".
      const patch = encodeNamespace(ns, value);
      const current = router.parseUrl(router.url).queryParamMap;
      const changed = Object.entries(patch).some(([key, next]) => {
        const had = current.getAll(key);
        if (next == null) {
          return had.length > 0;
        }
        const wanted = Array.isArray(next) ? next : [next];
        return had.length !== wanted.length || wanted.some((v, i) => v !== had[i]);
      });
      if (!changed) {
        return;
      }
      void router.navigate([], {
        relativeTo: route,
        queryParams: patch,
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    });
  }

  return state;
}

/** Read-only view of a {@link queryParamStore}. */
export type QueryParamStore<T extends ParamState> = Signal<T>;
