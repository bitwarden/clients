import { ApiService } from "../../abstractions/api.service";
import { BreachAccountResponse } from "../models";

import { HibpApiService } from "./hibp-api.service";

describe("HibpApiService", () => {
  let sut: HibpApiService;
  let apiService: jest.Mocked<ApiService>;

  beforeEach(() => {
    apiService = {
      send: jest.fn(),
    } as any;

    sut = new HibpApiService(apiService);
  });

  describe("getHibpBreach", () => {
    it("should properly URL encode username with special characters", async () => {
      const mockResponse = [{ name: "test" }];
      const username = "connect#bwpm@simplelogin.co";

      apiService.send.mockResolvedValue(mockResponse);

      const result = await sut.getHibpBreach(username);

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/hibp/breach?username=" + encodeURIComponent(username),
        null,
        true,
        true,
      );
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(BreachAccountResponse);
    });
  });
});
