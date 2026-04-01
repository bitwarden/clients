import { firstValueFrom, of } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { FakeStateProvider, mockAccountServiceWith } from "../../../spec";

import {
  LUNR_SEARCH_INDEX,
  LUNR_SEARCH_INDEXING,
  LunrSearchService,
} from "./lunr-search.service";

function createCipherView(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id as any;
  cipher.name = name;
  return cipher;
}

describe("LunrSearchService", () => {
  let fakeStateProvider: FakeStateProvider;
  let service: LunrSearchService;

  const userId = "user-id" as UserId;
  const mockLogService = {
    error: jest.fn(),
    info: jest.fn(),
    measure: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    service = new LunrSearchService(fakeStateProvider, mockLogService as unknown as LogService);
  });

  it("clears index state on ciphersUpdated", async () => {
    await fakeStateProvider
      .getUser(userId, LUNR_SEARCH_INDEX)
      .update(() => ({ version: "2.3.9", fields: [], fieldVectors: [] as any, invertedIndex: [], pipeline: [] }));
    await fakeStateProvider.getUser(userId, LUNR_SEARCH_INDEXING).update(() => true);

    await service.ciphersUpdated(userId);

    const searchIndex = await firstValueFrom(fakeStateProvider.getUser(userId, LUNR_SEARCH_INDEX).state$);
    const isIndexing = await firstValueFrom(fakeStateProvider.getUser(userId, LUNR_SEARCH_INDEXING).state$);

    expect(searchIndex).toBeNull();
    expect(isIndexing).toBe(false);
  });

  it("returns matching ciphers for a lunr query", async () => {
    const ciphers = [
      createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login"),
      createCipherView("22222222-2222-2222-2222-222222222222", "Work Card"),
    ];

    const result = await service.searchCiphers(userId, ">personal", ciphers);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Personal Login");
  });

  it("returns empty results when there are no matches", async () => {
    const ciphers = [createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login")];

    const result = await service.searchCiphers(userId, ">does-not-exist", ciphers);

    expect(result).toEqual([]);
  });

  it("does not start a second index build when indexing is already in progress", async () => {
    const ciphers = [createCipherView("11111111-1111-1111-1111-111111111111", "Personal Login")];

    const getIsIndexingSpy = jest.spyOn(service as any, "getIsIndexing").mockResolvedValue(true);
    const searchIsIndexingSpy = jest
      .spyOn(service as any, "searchIsIndexing$")
      .mockReturnValue(of(false));
    const setIsIndexingSpy = jest.spyOn(service as any, "setIsIndexing");
    const setIndexForSearchSpy = jest.spyOn(service as any, "setIndexForSearch");

    await (service as any).updateIndexForUser(userId, ciphers);

    expect(getIsIndexingSpy).toHaveBeenCalledWith(userId);
    expect(searchIsIndexingSpy).toHaveBeenCalledWith(userId);
    expect(setIsIndexingSpy).not.toHaveBeenCalled();
    expect(setIndexForSearchSpy).not.toHaveBeenCalled();
  });
});
