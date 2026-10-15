/** A multi-select chip's untyped `value()`, narrowed to its strings. */
export function selectedFilterStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
