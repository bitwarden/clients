/**
 * A multi-select chip's raw value, narrowed down to the strings it's actually made of.
 *
 * Takes `unknown` rather than a `FilterControl` — a chip's `value()` is untyped until read
 * through that contract, and this stays pure and Angular-free so it can be shared by every
 * caller reading one. A non-array value, `undefined`/`null`, and non-string members all
 * resolve to `[]` rather than throwing; a caller that needs "no selection" to mean something
 * other than an empty array (e.g. `null`, to match every row) wraps this rather than
 * re-filtering the value itself.
 */
export function selectedFilterStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
