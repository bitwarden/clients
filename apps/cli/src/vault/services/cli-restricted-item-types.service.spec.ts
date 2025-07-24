import { BehaviorSubject, of } from "rxjs";

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
  let restrictedItemTypesService: Partial<RestrictedItemTypesService>;

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

  beforeEach(() => {
    restrictedSubject = new BehaviorSubject<RestrictedCipherType[]>([]);

    restrictedItemTypesService = {
      restricted$: restrictedSubject,
      isCipherRestricted: jest.fn(),
      isCipherRestricted$: jest.fn(),
    };

    service = new CliRestrictedItemTypesService(
      restrictedItemTypesService as RestrictedItemTypesService,
    );
  });

  describe("filterRestrictedCiphers", () => {
    it("filters out restricted cipher types from array", async () => {
      restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);

      (restrictedItemTypesService.isCipherRestricted as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);
      const ciphers = [cardCipher, loginCipher, identityCipher];

      const result = await service.filterRestrictedCiphers(ciphers);

      expect(result).toEqual([loginCipher, identityCipher]);
    });

    it("returns all ciphers when no restrictions exist", async () => {
      restrictedSubject.next([]);

      (restrictedItemTypesService.isCipherRestricted as jest.Mock).mockReturnValue(false);

      const ciphers = [cardCipher, loginCipher, identityCipher];
      const result = await service.filterRestrictedCiphers(ciphers);

      expect(result).toEqual(ciphers);
    });

    it("handles empty cipher array", async () => {
      const result = await service.filterRestrictedCiphers([]);

      expect(result).toEqual([]);
    });
  });

  describe("isCipherRestricted", () => {
    it("returns true for restricted cipher type with no organization exemptions", async () => {
      (restrictedItemTypesService.isCipherRestricted$ as jest.Mock).mockReturnValue(of(true));

      const result = await service.isCipherRestricted(cardCipher);
      expect(result).toBe(true);
    });

    it("returns false for non-restricted cipher type", async () => {
      (restrictedItemTypesService.isCipherRestricted$ as jest.Mock).mockReturnValue(of(false));

      const result = await service.isCipherRestricted(loginCipher);
      expect(result).toBe(false);
    });

    it("returns false when no restrictions exist", async () => {
      (restrictedItemTypesService.isCipherRestricted$ as jest.Mock).mockReturnValue(of(false));

      const result = await service.isCipherRestricted(cardCipher);
      expect(result).toBe(false);
    });

    it("returns false for organization cipher when organization is in allowViewOrgIds", async () => {
      (restrictedItemTypesService.isCipherRestricted$ as jest.Mock).mockReturnValue(of(false));

      const result = await service.isCipherRestricted(cardCipher);
      expect(result).toBe(false);
    });
  });
});
