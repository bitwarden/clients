import { computed, signal } from "@angular/core";

/**
 * Definition of an available filter facet: a stable {@link id} and a
 * {@link label} for its chip/menu text. {@link predicate} is the client-side
 * matcher — supply it for in-memory filtering; omit it for server-side
 * filtering, where the facet contributes nothing to {@link FiltersModel.matches}
 * and the consumer instead reads {@link FiltersModel.applied} to build its
 * query. Definitions are set once; which ones are *applied* is tracked
 * separately, so applied state stays value-only.
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

/**
 * Facet-filter state for `bit-table-v2`. Holds the available
 * {@link FilterDefinition}s and which are applied, exposing the result as
 * {@link matches} so the table can compose it with {@link SearchModel} into the
 * rendered set. Applied facets are surfaced as value-only chips via
 * {@link applied} for the toolbar to render.
 */
export class FiltersModel<T> {
  private readonly definitions: Map<string, FilterDefinition<T>>;
  private readonly _appliedIds = signal<string[]>([]);

  constructor(definitions: FilterDefinition<T>[] = []) {
    this.definitions = new Map(definitions.map((d) => [d.id, d]));
  }

  /** Applied facets as value-only chips, for the toolbar to render. */
  readonly applied = computed<AppliedFilter[]>(() =>
    this._appliedIds()
      .map((id) => this.definitions.get(id))
      .filter((d): d is FilterDefinition<T> => d != null)
      .map((d) => ({ id: d.id, label: d.label })),
  );

  /**
   * Whether `row` passes every applied facet that supplied a predicate. Facets
   * without a predicate (server-side filtering) don't constrain the client
   * view, so this composes cleanly with other row tests.
   */
  matches(row: T): boolean {
    return this._appliedIds()
      .map((id) => this.definitions.get(id))
      .filter((d): d is FilterDefinition<T> => d != null)
      .every((d) => d.predicate == null || d.predicate(row));
  }

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

  /** Removes all applied facets. */
  clear(): void {
    this._appliedIds.set([]);
  }
}
