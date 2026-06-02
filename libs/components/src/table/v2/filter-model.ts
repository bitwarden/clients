import { computed, signal } from "@angular/core";

import { SearchConsumer } from "../../search/search-consumer";
import { FilterFn } from "../table-data-source";

/**
 * Definition of an available filter facet: a stable {@link id} and a
 * {@link label} for its chip/menu text. {@link predicate} is the client-side
 * matcher — supply it for in-memory filtering; omit it for server-side
 * filtering, where the facet contributes nothing to the composed client
 * predicate and the consumer instead reads {@link FilterModel.appliedFilters}
 * to build its query. Definitions are set once; which ones are *applied* is
 * tracked separately, so applied state stays value-only.
 */
export type FilterDefinition<T> = {
  id: string;
  label: string;
  predicate?: (row: T) => boolean;
};

/** An applied filter, surfaced for rendering as a dismissible chip. */
export type AppliedFilter = {
  id: string;
  label: string;
};

export type FilterModelConfig<T> = {
  /** How free-text search matches a row. Omit to disable search matching. */
  search?: (row: T, term: string) => boolean;
  /** Available filter facets, applied by {@link FilterDefinition.id}. */
  filters?: FilterDefinition<T>[];
};

/**
 * Filter state and definitions for `bit-table-v2`, constructed by the consumer
 * and passed via `[filterModel]` — parallel to `TableDataSource` and
 * `TableSelectionModel`. It owns the available facet {@link FilterDefinition}s,
 * the active search term and applied facets, and composes them into a single
 * {@link predicate} the table applies to its data source.
 *
 * Implements {@link SearchConsumer}, so a `<bit-search>` projected into the
 * table's toolbar binds to it automatically (the table provides the model under
 * `SEARCH_CONSUMER`).
 */
export class FilterModel<T> implements SearchConsumer {
  private readonly definitions: Map<string, FilterDefinition<T>>;
  private readonly searchMatcher?: (row: T, term: string) => boolean;

  private readonly _appliedIds = signal<string[]>([]);

  constructor(config: FilterModelConfig<T> = {}) {
    this.definitions = new Map((config.filters ?? []).map((d) => [d.id, d]));
    this.searchMatcher = config.search;
  }

  /** Search term, two-way bound by a `<bit-search>`. The {@link SearchConsumer} surface. */
  readonly searchTerm = signal("");

  /** Applied facets as value-only chips, for the toolbar to render. */
  readonly appliedFilters = computed<AppliedFilter[]>(() =>
    this._appliedIds()
      .map((id) => this.definitions.get(id))
      .filter((d): d is FilterDefinition<T> => d != null)
      .map((d) => ({ id: d.id, label: d.label })),
  );

  /**
   * Composed client-side row test: matches search (if any) AND every applied
   * facet that supplied a predicate. Facets without a predicate (server-side
   * filtering) don't constrain the client view.
   */
  readonly predicate = computed<FilterFn<T>>(() => {
    const term = this.searchTerm();
    const matcher = this.searchMatcher;
    const applied = this._appliedIds()
      .map((id) => this.definitions.get(id))
      .filter((d): d is FilterDefinition<T> => d != null);
    return (row: T) =>
      (term === "" || matcher == null || matcher(row, term)) &&
      applied.every((d) => d.predicate == null || d.predicate(row));
  });

  /** Applies a facet by id. No-op if the id is unknown or already applied. */
  apply(id: string): void {
    if (!this.definitions.has(id)) {
      return;
    }
    this._appliedIds.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }

  /** Removes an applied facet by id. */
  remove(id: string): void {
    this._appliedIds.update((ids) => ids.filter((x) => x !== id));
  }

  /** Toggles a facet on or off. */
  toggle(id: string): void {
    if (this._appliedIds().includes(id)) {
      this.remove(id);
    } else {
      this.apply(id);
    }
  }

  /** Removes all applied facets, leaving the search term intact. */
  clear(): void {
    this._appliedIds.set([]);
  }
}
