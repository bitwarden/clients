import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import { AccessEventService } from "@bitwarden/bit-pam";

import { PamMockStore } from "./pam-mock-store";

/**
 * DEMO ONLY — the fake "server push channel" for lease lifecycle events.
 *
 * In production {@link AccessEventService} is implemented by
 * `DefaultAccessEventService`, which subscribes to the app-wide WebPush/SignalR
 * notification stream and surfaces {@link NotificationType.RefreshAccessRequest}
 * pushes. There is no such server in the demo, so this mock stands in for that
 * channel: it maps {@link PamMockStore.events$} — the Subject the store fires when
 * a pending request auto-decides or a lease lapses — down to the same bare
 * "your access changed, re-fetch" tick the real service emits.
 *
 * Swapped in via `provide-pam.ts`, mirroring the `MockPamApiService` <->
 * `DefaultPamApiService` substitution.
 */
@Injectable({ providedIn: "root" })
export class MockAccessEventService extends AccessEventService {
  constructor(private readonly store: PamMockStore) {
    super();
  }

  accessChanged$(): Observable<void> {
    return this.store.events$.pipe(map((): void => undefined));
  }
}
