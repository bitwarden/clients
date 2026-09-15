import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { ManagedSettingsClient } from "@bitwarden/sdk-internal";

/**
 * A `ManagedSettingsService` whose `client$` emits a mock handle.
 *
 * Two spellings look correct and hang every caller that awaits `client$`:
 *
 * - `mock<ManagedSettingsService>({ client$ })` — `mock()` recurses into object-valued partials, so
 *   the observable is itself proxied. RxJS declares `operator` as a declaration-only field, so the
 *   proxy fabricates it as a function and `subscribe` calls it instead of `_subscribe`.
 * - `of(mock<ManagedSettingsClient>())` — a mock proxy answers every property with a function, so
 *   `isScheduler` is satisfied and `of` pops the handle off as a scheduler that never runs.
 *
 * Hence: assign after construction, and seed with a `BehaviorSubject`.
 */
export function mockManagedSettingsService(): MockProxy<ManagedSettingsService> {
  const managedSettingsService = mock<ManagedSettingsService>();
  managedSettingsService.client$ = new BehaviorSubject(mock<ManagedSettingsClient>());
  return managedSettingsService;
}
