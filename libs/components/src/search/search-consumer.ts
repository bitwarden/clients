import { InjectionToken, WritableSignal } from "@angular/core";

/**
 * Contract a container (e.g. `bit-table-v2`) provides so a `<bit-search>`
 * projected into it wires up automatically. When a `<bit-search>` finds a
 * {@link SEARCH_CONSUMER} on its element injector, it two-way binds to
 * {@link searchTerm} instead of acting as a standalone control — reading it for
 * display and setting it on input. `bit-search` depends only on this
 * abstraction, never on any concrete consumer.
 */
export interface SearchConsumer {
  /** The search term, read and written by `bit-search` (two-way). */
  readonly searchTerm: WritableSignal<string>;
}

export const SEARCH_CONSUMER = new InjectionToken<SearchConsumer>("SearchConsumer");
