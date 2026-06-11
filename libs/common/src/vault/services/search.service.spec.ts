import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { SearchService } from "./search.service";

function createCipherView(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  return cipher;
}

describe("SearchService", () => {
  let service: SearchService;

  const userId = "user-id" as UserId;
  const mockLogService = {
    error: jest.fn(),
    info: jest.fn(),
    measure: jest.fn(),
  };
  const mockLocale$ = new BehaviorSubject<string>("en");
  const mockI18nService = {
    locale$: mockLocale$.asObservable(),
  };
  const smartSearchEnabled$ = new BehaviorSubject<boolean>(false);
  const mockConfigService = {
    getFeatureFlag$: jest.fn().mockReturnValue(smartSearchEnabled$.asObservable()),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    smartSearchEnabled$.next(false);
    service = new SearchService(
      mockLogService as unknown as LogService,
      mockI18nService as unknown as I18nService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe("isSearchable", () => {
    it("returns false if the query is empty", async () => {
      const result = await service.isSearchable("");
      expect(result).toBe(false);
    });

    it("returns false if the query is null", async () => {
      const result = await service.isSearchable(null as any);
      expect(result).toBe(false);
    });

    it("returns true if the query is longer than searchableMinLength", async () => {
      service["searchableMinLength"] = 3;
      const result = await service.isSearchable("test");
      expect(result).toBe(true);
    });

    it("returns false if the query is shorter than searchableMinLength", async () => {
      service["searchableMinLength"] = 5;
      const result = await service.isSearchable("test");
      expect(result).toBe(false);
    });
  });

  describe("searchCiphers", () => {
    it("uses basic search for regular queries", async () => {
      const basicSearchSpy = jest.spyOn(service, "searchCiphersBasic");
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      const result = await service.searchCiphers(userId, null, "personal", ciphers);

      expect(basicSearchSpy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("returns original ciphers for non-searchable queries", async () => {
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      const result = await service.searchCiphers(userId, null, "", ciphers);

      expect(result).toEqual(ciphers);
    });
  });

  describe("searchCiphersBasic", () => {
    it("requires the query words in order when smart search is disabled", () => {
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      expect(service.searchCiphersBasic(ciphers, "personal login")).toHaveLength(1);
      // Out-of-order words do not form a contiguous substring with legacy search.
      expect(service.searchCiphersBasic(ciphers, "login personal")).toHaveLength(0);
    });

    it("matches words in any order when smart search is enabled", () => {
      smartSearchEnabled$.next(true);
      const ciphers = [createCipherView("cipher-1", "Personal Login")];

      expect(service.searchCiphersBasic(ciphers, "login personal")).toHaveLength(1);
    });
  });
});
