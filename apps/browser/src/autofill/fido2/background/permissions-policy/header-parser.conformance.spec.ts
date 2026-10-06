import { parseHeader } from "./header-parser";
import dictionaryTests from "./spec-fixtures/dictionary.json";
import { AllowlistItem, ParsedPermissionsPolicy } from "./types";

/**
 * HTTP WG structured-field-tests conformance runner for our header parser.
 *
 * Approach: run every dictionary test from the vendored WG suite through our
 * parser and check that we behave correctly given our design goal — parse the
 * dictionary structure faithfully, extract allowlist-relevant values (tokens
 * `*`/`self`, strings-as-origins, empty inner-lists), and drop directives
 * whose values are types we don't act on (integers, decimals, booleans, byte
 * sequences, dates).
 *
 * A test passes when:
 *   - `must_fail`: our parser returns an empty Map (parse rejected the input).
 *   - Otherwise: our parser produces exactly the directives we'd derive from
 *     the spec's expected output by filtering to allowlist-actionable values.
 *
 * The vendored fixtures come from https://github.com/httpwg/structured-field-tests
 * (main branch). Update by re-running the fetch in the conformance workflow.
 */

// Types matching the WG expected-shape format.
type WgTest = {
  name: string;
  raw: string[];
  header_type: "dictionary";
  expected?: WgDictionary;
  must_fail?: boolean;
  can_fail?: boolean;
};

type WgDictionary = Array<[string, WgValueWithParams]>;
type WgValueWithParams = [WgValue, WgParameters];
type WgParameters = Array<[string, WgValue]>;
type WgValue = number | boolean | string | WgTypedValue | Array<WgValueWithParams>;
type WgTypedValue = { __type: string; value: string };

describe("Header parser — HTTP WG dictionary conformance", () => {
  const tests = dictionaryTests as unknown as WgTest[];

  it.each(tests.map((t) => [t.name, t] as const))("%s", (_name, test) => {
    const combined = test.raw.join(", ");
    const actual = parseHeader(combined);

    if (test.must_fail === true) {
      // Spec says the input must be rejected. Our parser rejects on error by
      // returning an empty Map.
      expect(actual.size).toBe(0);
      return;
    }

    const expectedFromWg = deriveExpectedForOurParser(test.expected ?? []);
    expect(mapToObject(actual)).toEqual(mapToObject(expectedFromWg));
  });
});

/**
 * Translates the WG expected shape into what our parser is supposed to produce.
 * Filters out directives whose values are types we don't turn into allowlist
 * items (integers, decimals, booleans, binary, dates, unknown tokens, non-URL
 * strings). Retains directives whose values become a valid allowlist —
 * including empty allowlists for `feature=()`.
 */
function deriveExpectedForOurParser(wgDict: WgDictionary): ParsedPermissionsPolicy {
  const result = new Map<string, { feature: string; allowlist: AllowlistItem[] }>();
  for (const [feature, [value]] of wgDict) {
    const allowlist = valueToAllowlist(value);
    if (allowlist == null) {
      continue; // directive dropped
    }
    result.set(feature, { feature, allowlist });
  }
  return result;
}

function valueToAllowlist(value: WgValue): AllowlistItem[] | null {
  // Inner-list: array of [item, params] tuples.
  if (Array.isArray(value)) {
    const items: AllowlistItem[] = [];
    for (const [item] of value) {
      const converted = bareItemToAllowlist(item);
      if (converted != null) {
        items.push(converted);
      }
    }
    return items;
  }
  const bare = bareItemToAllowlist(value);
  return bare == null ? null : [bare];
}

function bareItemToAllowlist(item: WgValue): AllowlistItem | null {
  if (typeof item === "string") {
    // sf-string. Try to parse as origin.
    try {
      return { type: "origin", value: new URL(item).origin };
    } catch {
      return null;
    }
  }
  if (isTypedValue(item)) {
    if (item.__type === "token") {
      if (item.value === "*") {
        return { type: "wildcard" };
      }
      if (item.value === "self") {
        return { type: "self" };
      }
      return null;
    }
    // Other typed values (binary, date, displaystring, decimal) — dropped.
    return null;
  }
  // Numbers and booleans — dropped.
  return null;
}

function isTypedValue(v: unknown): v is WgTypedValue {
  return typeof v === "object" && v != null && "__type" in v && "value" in v;
}

// Convert Map to plain object for readable Jest diff output.
function mapToObject(
  m: ParsedPermissionsPolicy | Map<string, { feature: string; allowlist: AllowlistItem[] }>,
) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of m) {
    out[k] = v.allowlist;
  }
  return out;
}
