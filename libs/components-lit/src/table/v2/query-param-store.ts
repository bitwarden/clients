/** A URL-encodable scalar. */
export type ParamScalar = string | number | boolean;

/** A value synced to the URL: a scalar, a list of scalars, or absent. */
export type ParamValue = ParamScalar | readonly ParamScalar[] | undefined;

export type ParamState = Record<string, ParamValue>;

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

function encodeParamValue(value: ParamValue): string[] {
  if (value == null || value === "") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "").map((item) => encodeScalar(item));
  }
  return [encodeScalar(value as ParamScalar)];
}

/** Reads every `<namespace>.*` param of the current URL into a flat state record (keys un-prefixed). */
export function readQueryParams(namespace: string): ParamState {
  const params = new URLSearchParams(window.location.search);
  const prefix = `${namespace}.`;
  const state: ParamState = {};
  for (const fullKey of new Set(params.keys())) {
    if (fullKey.startsWith(prefix)) {
      const raw = params.getAll(fullKey);
      state[fullKey.slice(prefix.length)] =
        raw.length > 1 ? raw.map(decodeScalar) : decodeScalar(raw[0]);
    }
  }
  return state;
}

/**
 * Writes `state` to the URL under `namespace` with `history.replaceState`, leaving other params
 * alone. Empty values (`undefined`, `""`, `[]`) remove their param, so the URL self-cleans.
 * Replaces Angular's router-backed `queryParamStore`; the history stays flat.
 */
export function writeQueryParams(namespace: string, state: ParamState): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const [key, value] of Object.entries(state)) {
    const fullKey = `${namespace}.${key}`;
    const next = encodeParamValue(value);
    const current = url.searchParams.getAll(fullKey);
    if (current.length === next.length && current.every((v, i) => v === next[i])) {
      continue;
    }
    changed = true;
    url.searchParams.delete(fullKey);
    next.forEach((v) => url.searchParams.append(fullKey, v));
  }
  if (changed) {
    window.history.replaceState(window.history.state, "", url);
  }
}
