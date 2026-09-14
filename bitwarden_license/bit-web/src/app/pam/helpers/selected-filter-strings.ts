/**
 * A multi-select chip's raw value, narrowed to the strings it's made of.
 *
 * Takes `unknown` rather than a `FilterControl`: a chip's `value()` is untyped until read
 * through that contract, and staying Angular-free lets every caller reading one share this.
 * Anything that isn't an array of strings resolves to `[]` rather than throwing.
 */
export function selectedFilterStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
