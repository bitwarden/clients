import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { filter } from "rxjs/operators";

import { AccessEvent, AccessEventService } from "@bitwarden/pam";

import { PamMockStore } from "./pam-mock-store";

/**
 * DEMO ONLY — the fake "server push channel" for lease lifecycle events.
 *
 * In production {@link AccessEventService} is implemented by
 * `DefaultAccessEventService`, which subscribes to the app-wide WebPush/SignalR
 * notification stream and surfaces lease-approved / lease-denied push payloads.
 * There is no such server in the demo, so this mock stands in for that channel:
 * it republishes {@link PamMockStore.events$} — the Subject the store fires when
 * a pending request auto-decides — and filters by `requestId`, exactly matching
 * the real `events$(requestId)` contract.
 *
 * This is what lets `PendingStateComponent` hear "your request was approved" a
 * few seconds after the user submits the Request Access modal. Swapped in via
 * `provide-pam.ts`, mirroring the `MockPamApiService` <-> `DefaultPamApiService`
 * substitution.
 */
@Injectable({ providedIn: "root" })
export class MockAccessEventService extends AccessEventService {
  constructor(private readonly store: PamMockStore) {
    super();
  }

  events$(requestId: string): Observable<AccessEvent> {
    return this.store.events$.pipe(filter((event) => event.requestId === requestId));
  }

  allEvents$(): Observable<AccessEvent> {
    return this.store.events$.asObservable();
  }
}
