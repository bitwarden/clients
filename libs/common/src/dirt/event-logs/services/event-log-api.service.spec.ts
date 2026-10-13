import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { EventResponse } from "../models/response/event.response";

import { EventLogApiService } from "./event-log-api.service";

describe("EventLogApiService", () => {
  let sut: EventLogApiService;
  let apiService: jest.Mocked<ApiService>;

  beforeEach(() => {
    apiService = {
      send: jest.fn(),
    } as any;

    sut = new EventLogApiService(apiService);
  });

  describe("getEventsSend", () => {
    it("requests the Send events endpoint with start, end, and continuation token", async () => {
      apiService.send.mockResolvedValue({ data: [], continuationToken: null });

      const result = await sut.getEventsSend(
        "org-1",
        "send-1",
        "2024-01-01",
        "2024-01-31",
        "tok-1",
      );

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/org-1/sends/send-1/events?start=2024-01-01&end=2024-01-31&continuationToken=tok-1",
        null,
        true,
        true,
      );
      expect(result).toBeInstanceOf(ListResponse);
    });

    it("omits null query parameters", async () => {
      apiService.send.mockResolvedValue({ data: [], continuationToken: null });

      await sut.getEventsSend("org-1", "send-1", null, null, null);

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/org-1/sends/send-1/events",
        null,
        true,
        true,
      );
    });

    it("maps the response data into EventResponse items", async () => {
      apiService.send.mockResolvedValue({ data: [{ type: 1 }], continuationToken: null });

      const result = await sut.getEventsSend("org-1", "send-1", null, null, null);

      expect(result.data[0]).toBeInstanceOf(EventResponse);
    });
  });
});
