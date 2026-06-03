import { computed, signal } from "@angular/core";

/**
 * Free-text search state for `bit-table-v2`. Holds the active search
 * {@link term} and the matcher that decides whether a row passes it, exposing
 * the result as {@link matches} so the table can compose it with
 * {@link FiltersModel} into the rendered set.
 *
 * A `<bit-search>` projected into the table's toolbar two-way binds to
 * {@link term} (the table forwards it as the `SEARCH_CONSUMER`).
 */
export class SearchModel<T> {
  private readonly matcher?: (row: T, term: string) => boolean;

  constructor(matcher?: (row: T, term: string) => boolean) {
    this.matcher = matcher;
  }

  /** The active search term, two-way bound by a projected `<bit-search>`. */
  readonly term = signal("");

  /** Whether a search term is currently entered. */
  readonly active = computed(() => this.term() !== "");

  /**
   * Whether `row` passes the current term. Always `true` when the term is empty
   * or no matcher was supplied (search disabled), so it composes cleanly with
   * other row tests.
   */
  matches(row: T): boolean {
    const term = this.term();
    return term === "" || this.matcher == null || this.matcher(row, term);
  }
}
