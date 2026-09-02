import { CipherListView } from "@bitwarden/sdk-internal";

import { LogService } from "../../platform/abstractions/log.service";
import { OrganizationId, UserId } from "../../types/guid";
import { CipherType } from "../enums";
import { CipherView } from "../models/view/cipher.view";
import { LoginUriView } from "../models/view/login-uri.view";
import { LoginView } from "../models/view/login.view";

import { LunrSearchService } from "./lunr-search.service";

function createCipherView(id: string, name: string, revisionDate?: Date): CipherView {
  const cipher = new CipherView();
  cipher.id = id as any;
  cipher.name = name;
  if (revisionDate) {
    cipher.revisionDate = revisionDate;
  }
  return cipher;
}

function createLoginCipherView(id: string, name: string, uris: string[]): CipherView {
  const cipher = createCipherView(id, name);
  cipher.type = CipherType.Login;
  cipher.login = new LoginView();
  cipher.login.uris = uris.map((uri) => {
    const uriView = new LoginUriView();
    uriView.uri = uri;
    return uriView;
  });
  return cipher;
}

function createLoginCipherListView(id: string, name: string, uris: string[]): CipherListView {
  return {
    id,
    name,
    type: { login: { uris: uris.map((uri) => ({ uri })) } },
  } as unknown as CipherListView;
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

  it("builds a single index for concurrent searches over the same ciphers", async () => {
    const ciphers = [
      createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login"),
      createCipherView("22222222-2222-2222-2222-222222222222", "Work Card"),
    ];

    // Both searches are started before either can finish, so the second one waits on the index
    // lock held by the first and must reuse the index that build produced.
    const [first, second] = await Promise.all([
      service.searchCiphers(userId, null, ">personal", ciphers),
      service.searchCiphers(userId, null, ">work", ciphers),
    ]);

    expect(
      mockLogService.info.mock.calls.filter((call) => call[0] === "Starting Lunr index build"),
    ).toHaveLength(1);
    expect(first).toHaveLength(1);
    expect(first[0].name).toBe("Personal Login");
    expect(second).toHaveLength(1);
    expect(second[0].name).toBe("Work Card");
  });

  it("rebuilds rather than reusing an index for ciphers edited during the build", async () => {
    const indexedAt = new Date("2026-01-01T00:00:00.000Z");
    const editedAt = new Date("2026-01-02T00:00:00.000Z");
    const original = [
      createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login", indexedAt),
      createCipherView("22222222-2222-2222-2222-222222222222", "Work Card", indexedAt),
    ];
    // Same cipher count, but one was renamed after the first build's snapshot was taken. The
    // waiter must not be handed an index that never saw the edit.
    const edited = [
      createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login", indexedAt),
      createCipherView("22222222-2222-2222-2222-222222222222", "Work Card Renamed", editedAt),
    ];

    const [, second] = await Promise.all([
      service.searchCiphers(userId, null, ">personal", original),
      service.searchCiphers(userId, null, ">renamed", edited),
    ]);

    expect(
      mockLogService.info.mock.calls.filter((call) => call[0] === "Starting Lunr index build"),
    ).toHaveLength(2);
    expect(second).toHaveLength(1);
    expect(second[0].name).toBe("Work Card Renamed");
  });

  it("maintains separate indices for different organization ids", async () => {
    const ciphers = [createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login")];

    await service.searchCiphers(userId, null, ">personal", ciphers);
    await service.searchCiphers(userId, organizationId, ">personal", ciphers);

    expect(
      mockLogService.info.mock.calls.filter((call) => call[0] === "Starting Lunr index build"),
    ).toHaveLength(2);
  });

  describe("login URI indexing", () => {
    it("indexes the URI hostname for a CipherView login", async () => {
      const ciphers = [
        createLoginCipherView("11111111-1111-1111-1111-111111111111", "Work Login", [
          "https://example.com/path",
        ]),
      ];

      const result = await service.searchCiphers(userId, null, ">example.com", ciphers);

      expect(result).toHaveLength(1);
    });

    it("indexes the URI hostname for a CipherListView login", async () => {
      const ciphers = [
        createLoginCipherListView("11111111-1111-1111-1111-111111111111", "Work Login", [
          "https://example.com/path",
        ]),
      ];

      const result = await service.searchCiphers(userId, null, ">example.com", ciphers);

      expect(result).toHaveLength(1);
    });

    it("does not index the literal word 'null' when a URI has no parseable hostname", async () => {
      const ciphers = [
        createLoginCipherView("11111111-1111-1111-1111-111111111111", "Work Login", [
          "data:text/plain,hello",
        ]),
        createLoginCipherListView("22222222-2222-2222-2222-222222222222", "Other Login", [
          "data:text/plain,hello",
        ]),
      ];

      const result = await service.searchCiphers(userId, null, ">null", ciphers);

      expect(result).toEqual([]);
    });
  });
});
