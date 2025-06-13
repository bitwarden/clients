import { BehaviorSubject } from "rxjs";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedItemTypesService,
  RestrictedCipherType,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

import { CliRestrictedItemTypesService } from "./cli-restricted-item-types.service";

describe("CliRestrictedItemTypesService", () => {
  let service: CliRestrictedItemTypesService;
  let restrictedSubject: BehaviorSubject<RestrictedCipherType[]>;
  let restrictedItemTypesService: RestrictedItemTypesService;

  beforeEach(() => {
    restrictedSubject = new BehaviorSubject<RestrictedCipherType[]>([]);

    restrictedItemTypesService = {
      restricted$: restrictedSubject.asObservable(),
    } as RestrictedItemTypesService;

    service = new CliRestrictedItemTypesService(restrictedItemTypesService);
  });

  describe("filterRestrictedCiphers", () => {
    const cardCipher: CipherView = {
      id: "cipher1",
      type: CipherType.Card,
      organizationId: "org1",
    } as CipherView;

    const loginCipher: CipherView = {
      id: "cipher2",
      type: CipherType.Login,
      organizationId: "org1",
    } as CipherView;

    const identityCipher: CipherView = {
      id: "cipher3",
      type: CipherType.Identity,
      organizationId: "org2",
    } as CipherView;

    it("filters out restricted cipher types from array", async () => {
      restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);
      const ciphers = [cardCipher, loginCipher, identityCipher];

      const result = await service.filterRestrictedCiphers(ciphers);

      expect(result).toEqual([loginCipher, identityCipher]);
    });

    it("returns all ciphers when no restrictions exist", async () => {
      restrictedSubject.next([]);

      const ciphers = [cardCipher, loginCipher, identityCipher];
      const result = await service.filterRestrictedCiphers(ciphers);

      expect(result).toEqual(ciphers);
    });

    it("handles empty cipher array", async () => {
      const result = await service.filterRestrictedCiphers([]);

      expect(result).toEqual([]);
    });
  });

  describe("isCipherTypeRestricted", () => {
    it("returns true for restricted cipher type", async () => {
      restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);

      const result = await service.isCipherTypeRestricted(CipherType.Card);
      expect(result).toBe(true);
    });

    it("returns false for non-restricted cipher type", async () => {
      restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);

      const result = await service.isCipherTypeRestricted(CipherType.Login);
      expect(result).toBe(false);
    });

    it("returns false when user has no organizations", async () => {
      restrictedSubject.next([]);

      const result = await service.isCipherTypeRestricted(CipherType.Card);
      expect(result).toBe(false);
    });
  });
});
