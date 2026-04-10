import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { LunrSearchService } from "./lunr-search.service";

function createCipherView(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id as any;
  cipher.name = name;
  return cipher;
}

describe("LunrSearchService", () => {
  let service: LunrSearchService;

  const userId = "user-id" as UserId;
  const organizationId = "organization-id" as OrganizationId;
  const mockLogService = {
    error: jest.fn(),
    info: jest.fn(),
    measure: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LunrSearchService(mockLogService as unknown as LogService);
  });

  it("returns matching ciphers for a lunr query", async () => {
    const ciphers = [
      createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login"),
      createCipherView("22222222-2222-2222-2222-222222222222", "Work Card"),
    ];

    const result = await service.searchCiphers(userId, null, ">personal", ciphers);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Personal Login");
  });

  it("returns empty results when there are no matches", async () => {
    const ciphers = [createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login")];

    const result = await service.searchCiphers(userId, null, ">does-not-exist", ciphers);

    expect(result).toEqual([]);
  });

  it("reuses an existing up-to-date index", async () => {
    const ciphers = [createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login")];

    await service.searchCiphers(userId, null, ">personal", ciphers);
    await service.searchCiphers(userId, null, ">personal", ciphers);

    expect(mockLogService.info).toHaveBeenCalledWith("Starting Lunr index build");
    expect(
      mockLogService.info.mock.calls.filter((call) => call[0] === "Starting Lunr index build"),
    ).toHaveLength(1);
  });

  it("maintains separate indices for different organization ids", async () => {
    const ciphers = [createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login")];

    await service.searchCiphers(userId, null, ">personal", ciphers);
    await service.searchCiphers(userId, organizationId, ">personal", ciphers);

    expect(
      mockLogService.info.mock.calls.filter((call) => call[0] === "Starting Lunr index build"),
    ).toHaveLength(2);
  });
});
