import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../spec";

import { SearchService } from "./search.service";

describe("SearchService", () => {
  let fakeStateProvider: FakeStateProvider;
  let service: SearchService;

  const userId = "user-id" as UserId;
  const mockLogService = {
    error: jest.fn(),
    measure: jest.fn(),
  };
  const mockLocale$ = new BehaviorSubject<string>("en");
  const mockI18nService = {
    locale$: mockLocale$.asObservable(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    service = new SearchService(
      mockLogService as unknown as LogService,
      mockI18nService as unknown as I18nService,
      fakeStateProvider,
    );
  });

  describe("isSearchable", () => {
    let mockIndex$: jest.Mock;
    beforeEach(() => {
      mockIndex$ = jest.fn();
      service["index$"] = mockIndex$;
    });

    it("returns false if the query is empty", async () => {
      const result = await service.isSearchable(userId, "");
      expect(result).toBe(false);
      // Ensure we do not call the expensive index$ method
      expect(mockIndex$).not.toHaveBeenCalled();
    });

    it("returns false if the query is null", async () => {
      const result = await service.isSearchable(userId, null as any);
      expect(result).toBe(false);
      // Ensure we do not call the expensive index$ method
      expect(mockIndex$).not.toHaveBeenCalled();
    });

    it("return true if the query is longer than searchableMinLength", async () => {
      service["searchableMinLength"] = 3;
      const result = await service.isSearchable(userId, "test");
      expect(result).toBe(true);
      // Ensure we do not call the expensive index$ method
      expect(mockIndex$).not.toHaveBeenCalled();
    });

    it("returns false if the query is shorter than searchableMinLength", async () => {
      service["searchableMinLength"] = 5;
      const result = await service.isSearchable(userId, "test");
      expect(result).toBe(false);
      // Ensure we do not call the expensive index$ method
      expect(mockIndex$).not.toHaveBeenCalled();
    });

    it("returns false for short Lunr query with missing index", async () => {
      mockIndex$.mockReturnValue(new BehaviorSubject(null));
      service["searchableMinLength"] = 3;
      const result = await service.isSearchable(userId, ">l");
      expect(result).toBe(false);
      expect(mockIndex$).toHaveBeenCalledWith(userId);
    });

    it("returns true for short Lunr query with index", async () => {
      mockIndex$.mockReturnValue(new BehaviorSubject(true));
      service["searchableMinLength"] = 3;
      const result = await service.isSearchable(userId, ">l");
      expect(result).toBe(true);
      expect(mockIndex$).toHaveBeenCalledWith(userId);
    });
  });
});
