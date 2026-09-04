/** A `bit-filter-option`'s binding: the row-model value it selects for, and its display label. */
export type FilterOption<T> = { value: T; label: string };

/**
 * The distinct options in a set of `[value, label]` pairs, sorted by label.
 *
 * Callers pass one pair per row on screen, so an option that would match nothing never reaches the
 * menu. The labels are already translated, so the ordering follows the active locale.
 */
export function filterOptions<T>(pairs: readonly (readonly [T, string])[]): FilterOption<T>[] {
  return [...new Map(pairs)]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
