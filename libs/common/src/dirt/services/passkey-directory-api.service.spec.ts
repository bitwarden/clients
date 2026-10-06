import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../abstractions/api.service";
import { UserId } from "../../types/guid";

import { DefaultPasskeyDirectoryApiService } from "./default-passkey-directory-api.service";

describe("PasskeyDirectoryApiService", () => {
  let service: DefaultPasskeyDirectoryApiService;
  let apiServiceMock: MockProxy<ApiService>;

  beforeEach(() => {
    apiServiceMock = mock<ApiService>();
    service = new DefaultPasskeyDirectoryApiService(apiServiceMock);
  });

  describe("getPasskeyDirectory", () => {
    const userId = "user-id" as UserId;

    it("should call the correct API endpoint", async () => {
      apiServiceMock.send.mockResolvedValue([]);

      await service.getPasskeyDirectory(userId);

      expect(apiServiceMock.send).toHaveBeenCalledWith(
        "GET",
        "/reports/passkey-directory",
        null,
        userId,
        true,
      );
    });

    it("should map response entries to PasskeyDirectoryEntryResponse", async () => {
      apiServiceMock.send.mockResolvedValue([
        { DomainName: "example.com", Instructions: "https://example.com/setup" },
        { DomainName: "test.com", Instructions: null },
      ]);

      const result = await service.getPasskeyDirectory(userId);

      expect(result).toHaveLength(2);
      expect(result[0].domainName).toEqual("example.com");
      expect(result[0].instructions).toEqual("https://example.com/setup");
      expect(result[1].domainName).toEqual("test.com");
      expect(result[1].instructions).toBeNull();
    });

    it("should return empty array when API returns empty", async () => {
      apiServiceMock.send.mockResolvedValue([]);

      const result = await service.getPasskeyDirectory(userId);

      expect(result).toEqual([]);
    });
  });
});
