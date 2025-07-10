import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventResponse } from "@bitwarden/common/models/response/event.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

@Injectable({
  providedIn: "root",
})
export class ServiceAccountEventLogApiService {
  constructor(private apiService: ApiService) {}

  async getEvents(
    serviceAccountId: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.apiService.send(
      "GET",
      this.addEventParameters("/sm/events/service-accounts/" + serviceAccountId, start, end, token),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }

  private addEventParameters(base: string, start: string, end: string, token: string) {
    if (start != null) {
      base += "?start=" + start;
    }
    if (end != null) {
      base += base.indexOf("?") > -1 ? "&" : "?";
      base += "end=" + end;
    }
    if (token != null) {
      base += base.indexOf("?") > -1 ? "&" : "?";
      base += "continuationToken=" + token;
    }
    return base;
  }
}
