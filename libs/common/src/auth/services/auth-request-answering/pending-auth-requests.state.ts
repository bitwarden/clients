import { Observable } from "rxjs";

import {
  AUTH_REQUEST_DISK_LOCAL,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/user-core";

export type PendingAuthUserMarker = {
  userId: UserId;
  receivedAtMs: number;
};

export const PENDING_AUTH_REQUESTS = KeyDefinition.array<PendingAuthUserMarker>(
  AUTH_REQUEST_DISK_LOCAL,
  "pendingAuthRequests",
  {
    deserializer: (json) => json,
  },
);

export class PendingAuthRequestsStateService {
  private readonly state: GlobalState<PendingAuthUserMarker[]>;

  constructor(private readonly stateProvider: StateProvider) {
    this.state = this.stateProvider.getGlobal(PENDING_AUTH_REQUESTS);
  }

  getAll$(): Observable<PendingAuthUserMarker[] | null> {
    return this.state.state$;
  }

  async add(userId: UserId): Promise<void> {
    const now = Date.now();
    await this.stateProvider.getGlobal(PENDING_AUTH_REQUESTS).update((current) => {
      const list = (current ?? []).filter((e) => e.userId !== userId);
      return [...list, { userId, receivedAtMs: now }];
    });
  }

  async pruneOlderThan(maxAgeMs: number): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    await this.stateProvider.getGlobal(PENDING_AUTH_REQUESTS).update((current) => {
      const list = current ?? [];
      return list.filter((e) => e.receivedAtMs >= cutoff);
    });
  }

  async clear(userId: UserId): Promise<void> {
    await this.stateProvider.getGlobal(PENDING_AUTH_REQUESTS).update((current) => {
      const list = current ?? [];
      return list.filter((e) => e.userId !== userId);
    });
  }
}
