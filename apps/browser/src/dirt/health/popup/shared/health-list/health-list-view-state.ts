import { effect, inject, WritableSignal } from "@angular/core";

import { SignalCacheOptions, ViewCacheService } from "@bitwarden/angular/platform/view-cache";

import { HealthListSessionState } from "./health-list-session-state";

/** What a Health list keeps when the user opens an item and comes back. */
export type HealthListViewState<F, S extends string> = Readonly<{
  /** The table's filter values, search included, to seed `bit-table-v2 [filters]` with. */
  filters: WritableSignal<Partial<F>>;
  sort: WritableSignal<S>;
  /** The list's scroll offset, for {@link rememberHealthListScroll}. */
  scrollTop: WritableSignal<number>;
}>;

/**
 * A popup view cache signal that also survives the page being rebuilt while the popup stays
 * open. Call in an injection context.
 */
export function healthListSignal<T>(options: SignalCacheOptions<T>): WritableSignal<T> {
  const session = inject(HealthListSessionState);
  const cached = inject(ViewCacheService).signal(options);
  if (session.has(options.key)) {
    cached.set(session.get(options.key) as T);
  }
  effect(() => session.set(options.key, cached()));
  return cached;
}

/**
 * A Health list's search, filters, sort and scroll offset, kept in the popup view cache with
 * `persistNavigation`, and in memory while the popup stays open. The cache lives in memory and holds
 * JSON, so only ids and strings belong in `filters`, never vault items. Call in an injection
 * context. `key` must be unique per list.
 */
export function injectHealthListViewState<F extends object, S extends string>(
  key: string,
  initial: Readonly<{ filters: Partial<F>; sort: S }>,
): HealthListViewState<F, S> {
  // Spelled out: the options type branches on whether the value is JSON, which a generic
  // `F` or `S` cannot settle. Both are JSON here, and each brings its own deserializer.
  const filtersOptions = {
    key: `${key}-filters`,
    initialValue: initial.filters,
    persistNavigation: true,
    deserializer: (value: unknown) => (value ?? initial.filters) as Partial<F>,
  } as unknown as SignalCacheOptions<Partial<F>>;
  const sortOptions = {
    key: `${key}-sort`,
    initialValue: initial.sort,
    persistNavigation: true,
    deserializer: (value: unknown) => (value ?? initial.sort) as S,
  } as unknown as SignalCacheOptions<S>;

  return {
    filters: healthListSignal(filtersOptions),
    sort: healthListSignal(sortOptions),
    scrollTop: healthListSignal<number>({
      key: `${key}-scroll`,
      initialValue: 0,
      persistNavigation: true,
    }),
  };
}
