import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { filter } from "rxjs/operators";

import { LeaseEvent, LeaseEventService } from "@bitwarden/pam";

import { PamMockStore } from "./pam-mock-store";

/**
 * DEMO ONLY — wraps the mock store's `events$` Subject and filters by
 * `requestId`, matching {@link LeaseEventService.events$} semantics.
 */
@Injectable({ providedIn: "root" })
export class MockLeaseEventService extends LeaseEventService {
  constructor(private readonly store: PamMockStore) {
    super();
  }

  events$(requestId: string): Observable<LeaseEvent> {
    return this.store.events$.pipe(filter((event) => event.requestId === requestId));
  }
}
