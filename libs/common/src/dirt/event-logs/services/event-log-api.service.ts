import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { EventResponse } from "../models/response/event.response";

import { addEventParameters } from "./event-query-params.util";

export class EventLogApiService {
  constructor(private apiService: ApiService) {}

  async getEventsSend(
    orgId: string,
    id: string,
    start: string,
    end: string,
    token: string,
  ): Promise<ListResponse<EventResponse>> {
    const r = await this.apiService.send(
      "GET",
      addEventParameters("/organizations/" + orgId + "/sends/" + id + "/events", start, end, token),
      null,
      true,
      true,
    );
    return new ListResponse(r, EventResponse);
  }
}
