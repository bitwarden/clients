import { map, Observable, switchMap } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { StateProvider } from "../../../platform/state";
import { AlertDismissalId, CipherId, UserId } from "../../../types/guid";
import { AlertDismissalData } from "../../models/data/alert-dismissal.data";
import { AlertDismissalResponse } from "../../models/response/alert-dismissal.response";
import { filterOutNullish, perUserCache$ } from "../../utils/observable-utilities";
import { AlertDismissalService } from "../abstractions/alert-dismissal.service";
import { ALERT_DISMISSALS } from "../state/alert-dismissal.state";

export class DefaultAlertDismissalService implements AlertDismissalService {
  constructor(
    private apiService: ApiService,
    private stateProvider: StateProvider,
  ) {}

  dismissals$ = perUserCache$((userId: UserId) => {
    return this.dismissalState(userId).state$.pipe(
      switchMap(async (dismissals) => {
        if (dismissals == null) {
          await this.fetchFromApi(userId);
          return null;
        }
        return dismissals;
      }),
      filterOutNullish(),
    );
  });

  isDismissed$(cipherId: CipherId, userId: UserId): Observable<boolean> {
    return this.dismissals$(userId).pipe(
      map((dismissals) => dismissals.some((d) => d.cipherId === cipherId)),
    );
  }

  async dismiss(cipherId: CipherId, userId: UserId, notes?: string): Promise<void> {
    const r = await this.apiService.send(
      "POST",
      "/alerts/dismissals",
      { cipherId, notes: notes ?? null },
      true,
      true,
    );
    const response = new AlertDismissalResponse(r);
    const newEntry = new AlertDismissalData(response);
    await this.dismissalState(userId).update((existing) => [...(existing ?? []), newEntry]);
  }

  async undismiss(dismissalId: AlertDismissalId, userId: UserId): Promise<void> {
    await this.apiService.send("DELETE", `/alerts/dismissals/${dismissalId}`, null, true, false);
    await this.dismissalState(userId).update((existing) =>
      (existing ?? []).filter((d) => d.id !== dismissalId),
    );
  }

  async syncDismissals(dismissals: AlertDismissalResponse[], userId: UserId): Promise<void> {
    const data = dismissals.map((r) => new AlertDismissalData(r));
    await this.dismissalState(userId).update(() => data);
  }

  private dismissalState(userId: UserId) {
    return this.stateProvider.getUser(userId, ALERT_DISMISSALS);
  }

  private async fetchFromApi(userId: UserId): Promise<void> {
    const r = await this.apiService.send("GET", "/alerts/dismissals", null, true, true);
    const response = new ListResponse(r, AlertDismissalResponse);
    const data = response.data.map((d) => new AlertDismissalData(d));
    await this.dismissalState(userId).update(() => data);
  }
}
