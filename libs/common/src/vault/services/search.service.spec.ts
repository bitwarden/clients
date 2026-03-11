import { BehaviorSubject, firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IndexedEntityId, UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { FakeStateProvider, mockAccountServiceWith } from "../../../spec";

import { SearchService } from "./search.service";

function createCipherView(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  return cipher;
}

describe("SearchService", () => {
  let fakeStateProvider: FakeStateProvider;
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
  });

  describe("searchCiphers with indexedEntityId", () => {
    const orgEntityId = "org-id" as IndexedEntityId;
    const personalCiphers = [createCipherView("cipher-1", "Personal Login")];
    const orgCiphers = [createCipherView("cipher-2", "Org Login")];

    it("clears and rebuilds the index when indexedEntityId changes", async () => {
      // First search: build an index for the org context
      await service.searchCiphers(userId, ">Org", undefined, orgCiphers, orgEntityId);

      // The stored entity ID should be the org entity
      const storedEntityId = await firstValueFrom(service.indexedEntityId$(userId));
      expect(storedEntityId).toBe(orgEntityId);

      // Spy on clearIndex to verify it gets called when the entity changes
      const clearIndexSpy = jest.spyOn(service, "clearIndex");

      // Second search: search without an entity ID (personal vault)
      await service.searchCiphers(userId, ">Personal", undefined, personalCiphers);

      expect(clearIndexSpy).toHaveBeenCalledWith(userId);

      // The stored entity ID should now be undefined (personal vault)
      const updatedEntityId = await firstValueFrom(service.indexedEntityId$(userId));
      expect(updatedEntityId).toBeUndefined();
    });

    it("does not clear the index when the same indexedEntityId is used", async () => {
      // First search: build an index for the org context
      await service.searchCiphers(userId, ">Org", undefined, orgCiphers, orgEntityId);

      const clearIndexSpy = jest.spyOn(service, "clearIndex");

      // Second search: same org entity ID
      await service.searchCiphers(userId, ">Org", undefined, orgCiphers, orgEntityId);

      expect(clearIndexSpy).not.toHaveBeenCalled();
    });

    it("does not clear the index when no indexedEntityId is provided and index was built without one", async () => {
      // First search: build an index for personal vault (no entity ID)
      await service.searchCiphers(userId, ">Personal", undefined, personalCiphers);

      const clearIndexSpy = jest.spyOn(service, "clearIndex");

      // Second search: also no entity ID
      await service.searchCiphers(userId, ">Personal", undefined, personalCiphers);

      expect(clearIndexSpy).not.toHaveBeenCalled();
    });

    it("clears and rebuilds the index when switching from personal vault to org", async () => {
      // First search: build an index for personal vault
      await service.searchCiphers(userId, ">Personal", undefined, personalCiphers);

      const storedEntityId = await firstValueFrom(service.indexedEntityId$(userId));
      expect(storedEntityId).toBeUndefined();

      const clearIndexSpy = jest.spyOn(service, "clearIndex");

      // Second search: switch to org context
      await service.searchCiphers(userId, ">Org", undefined, orgCiphers, orgEntityId);

      expect(clearIndexSpy).toHaveBeenCalledWith(userId);

      const updatedEntityId = await firstValueFrom(service.indexedEntityId$(userId));
      expect(updatedEntityId).toBe(orgEntityId);
    });
  });
});
