import { EnvironmentInjector, runInInjectionContext } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherListView } from "@bitwarden/sdk-internal";

import { VaultCipherListService } from "./vault-cipher-list.service";

const USER_ID = "user-1" as UserId;
const ORG_ID = "org-1" as OrganizationId;

function buildOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    isMember: true,
    isProviderUser: false,
    canEditAllCiphers: false,
    ...overrides,
  } as Organization;
}

function buildListView(id: string, overrides: Partial<CipherListView> = {}): CipherListView {
  return {
    id,
    name: `Cipher ${id}`,
    type: "secureNote",
    edit: false,
    viewPassword: false,
    ...overrides,
  } as unknown as CipherListView;
}

function buildEncryptedCipher(id: string): Cipher {
  return { id } as unknown as Cipher;
}

describe("VaultCipherListService", () => {
  let service: VaultCipherListService;
  let cipherService: MockProxy<CipherService>;

  beforeEach(() => {
    cipherService = mock<CipherService>();

    TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: mockAccountServiceWith(USER_ID) },
      ],
    });

    service = runInInjectionContext(TestBed.inject(EnvironmentInjector), () => {
      return new VaultCipherListService();
    });
  });

  describe("load", () => {
    it("returns no ciphers for provider users who are not members", async () => {
      const result = await service.load(buildOrg({ isMember: false, isProviderUser: true }));

      expect(result).toEqual([]);
      expect(cipherService.getAllListViewsFromApiForOrganization).not.toHaveBeenCalled();
      expect(cipherService.getManyListViewsFromApiForOrganization).not.toHaveBeenCalled();
    });

    it("loads all ciphers as list views and grants full access when the user can edit all ciphers", async () => {
      const listView = buildListView("cipher-1");
      cipherService.getAllListViewsFromApiForOrganization.mockResolvedValue({
        ciphers: [buildEncryptedCipher("cipher-1")],
        views: [listView],
      });

      const result = await service.load(buildOrg({ canEditAllCiphers: true }));

      expect(cipherService.getAllListViewsFromApiForOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(cipherService.getManyListViewsFromApiForOrganization).not.toHaveBeenCalled();
      expect(result).toEqual([listView]);
      expect(listView.edit).toBe(true);
      expect(listView.viewPassword).toBe(true);
    });

    it("loads only assigned ciphers as list views when the user cannot edit all ciphers", async () => {
      const listView = buildListView("cipher-1");
      cipherService.getManyListViewsFromApiForOrganization.mockResolvedValue({
        ciphers: [buildEncryptedCipher("cipher-1")],
        views: [listView],
      });

      const result = await service.load(buildOrg());

      expect(cipherService.getManyListViewsFromApiForOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(cipherService.getAllListViewsFromApiForOrganization).not.toHaveBeenCalled();
      expect(result).toEqual([listView]);
      expect(listView.edit).toBe(false);
    });

    it("does not decrypt any full ciphers", async () => {
      cipherService.getManyListViewsFromApiForOrganization.mockResolvedValue({
        ciphers: [buildEncryptedCipher("cipher-1")],
        views: [buildListView("cipher-1")],
      });

      await service.load(buildOrg());

      expect(cipherService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe("getFullCipherView", () => {
    it("decrypts the loaded encrypted cipher for a list view, keeping its permissions", async () => {
      const encrypted = buildEncryptedCipher("cipher-1");
      const listView = buildListView("cipher-1");
      cipherService.getAllListViewsFromApiForOrganization.mockResolvedValue({
        ciphers: [encrypted],
        views: [listView],
      });
      await service.load(buildOrg({ canEditAllCiphers: true }));

      const decrypted = new CipherView();
      cipherService.decrypt.mockResolvedValue(decrypted);

      const result = await service.getFullCipherView(listView);

      expect(cipherService.decrypt).toHaveBeenCalledWith(encrypted, USER_ID);
      expect(result).toBe(decrypted);
      expect(result.edit).toBe(true);
      expect(result.viewPassword).toBe(true);
    });

    it("returns a full cipher view as-is", async () => {
      const cipherView = new CipherView();

      const result = await service.getFullCipherView(cipherView);

      expect(result).toBe(cipherView);
      expect(cipherService.decrypt).not.toHaveBeenCalled();
    });

    it("throws when the list view's cipher was not loaded", async () => {
      await expect(service.getFullCipherView(buildListView("unknown"))).rejects.toThrow();
    });

    it("keeps the ciphers of the latest load when an earlier load finishes last", async () => {
      let resolveFirst!: (value: { ciphers: Cipher[]; views: CipherListView[] }) => void;
      cipherService.getManyListViewsFromApiForOrganization
        .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce({
          ciphers: [buildEncryptedCipher("cipher-2")],
          views: [buildListView("cipher-2")],
        });

      const firstLoad = service.load(buildOrg());
      await service.load(buildOrg());
      resolveFirst({ ciphers: [buildEncryptedCipher("cipher-1")], views: [] });
      await firstLoad;

      cipherService.decrypt.mockResolvedValue(new CipherView());
      await expect(service.getFullCipherView(buildListView("cipher-2"))).resolves.toBeDefined();
      await expect(service.getFullCipherView(buildListView("cipher-1"))).rejects.toThrow();
    });
  });
});
