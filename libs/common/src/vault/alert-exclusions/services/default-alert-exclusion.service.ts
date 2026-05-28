import { map, Observable, switchMap } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { ErrorResponse } from "../../../models/response/error.response";
import { ListResponse } from "../../../models/response/list.response";
import { LogService } from "../../../platform/abstractions/log.service";
import { StateProvider } from "../../../platform/state";
import { AlertExclusionId, CipherId, UserId } from "../../../types/guid";
import { AlertExclusionData } from "../../models/data/alert-exclusion.data";
import { AlertExclusionResponse } from "../../models/response/alert-exclusion.response";
import { filterOutNullish, perUserCache$ } from "../../utils/observable-utilities";
import { AlertExclusionService } from "../abstractions/alert-exclusion.service";
import { ALERT_EXCLUSIONS } from "../state/alert-exclusion.state";

export class DefaultAlertExclusionService implements AlertExclusionService {
  private readonly inFlightFetches = new Map<UserId, Promise<void>>();

  constructor(
    private apiService: ApiService,
    private stateProvider: StateProvider,
    private logService: LogService,
  ) {}

  exclusions$ = perUserCache$((userId: UserId) => {
    return this.exclusionState(userId).state$.pipe(
      switchMap(async (exclusions) => {
        if (exclusions == null) {
          await this.fetchFromApi(userId);
          return null;
        }
        return exclusions;
      }),
      filterOutNullish(),
    );
  });

  isExcluded$(cipherId: CipherId, userId: UserId): Observable<boolean> {
    return this.exclusions$(userId).pipe(
      map((exclusions) => exclusions.some((e) => e.cipherId === cipherId)),
    );
  }

  async exclude(cipherId: CipherId, userId: UserId, riskTypes: number): Promise<void> {
    // Wire format: server endpoint is /alerts/dismissals (legacy server contract).
    const r = await this.apiService.send(
      "POST",
      "/alerts/dismissals",
      { cipherId, notes: null, riskTypes },
      true,
      true,
    );
    const response = new AlertExclusionResponse(r);
    const newEntry = new AlertExclusionData(response);
    await this.exclusionState(userId).update((existing) => [
      ...(existing ?? []).filter((e) => e.id !== newEntry.id),
      newEntry,
    ]);
  }

  async removeExclusion(exclusionId: AlertExclusionId, userId: UserId): Promise<void> {
    await this.apiService.send("DELETE", `/alerts/dismissals/${exclusionId}`, null, true, false);
    await this.exclusionState(userId).update((existing) =>
      (existing ?? []).filter((e) => e.id !== exclusionId),
    );
  }

  async syncExclusions(exclusions: AlertExclusionResponse[], userId: UserId): Promise<void> {
    const data = exclusions.map((r) => new AlertExclusionData(r));
    await this.exclusionState(userId).update(() => data);
  }

  private exclusionState(userId: UserId) {
    return this.stateProvider.getUser(userId, ALERT_EXCLUSIONS);
  }

  private fetchFromApi(userId: UserId): Promise<void> {
    const existing = this.inFlightFetches.get(userId);
    if (existing != null) {
      return existing;
    }
    const promise = this.doFetchFromApi(userId).finally(() => {
      this.inFlightFetches.delete(userId);
    });
    this.inFlightFetches.set(userId, promise);
    return promise;
  }

  private async doFetchFromApi(userId: UserId): Promise<void> {
    try {
      const r = await this.apiService.send("GET", "/alerts/dismissals", null, true, true);
      const response = new ListResponse(r, AlertExclusionResponse);
      const data = response.data.map((d) => new AlertExclusionData(d));
      await this.exclusionState(userId).update(() => data);
    } catch (e) {
      // Only swallow 404 (server endpoint not yet deployed): seed empty so subscribers
      // don't re-trigger the failing fetch every emission. Other errors (401, 5xx) must
      // re-throw so they aren't masked and so the next sync retries.
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        await this.exclusionState(userId).update(() => []);
        return;
      }
      this.logService.error("Failed to fetch alert exclusions", e);
      throw e;
    }
  }
}
