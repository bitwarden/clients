import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherId } from "@bitwarden/sdk-internal";

import { ORGANIZATION_ID, id } from "./testing/rotation-builders";

import { OrgCiphersService } from "./org-ciphers.service";

const ORG_ID = ORGANIZATION_ID as OrganizationId;
const USER_ID = "user-1" as UserId;

/** Create a minimal CipherView stub. */
function makeCipher(
  id: string,
  name: string,
  type: CipherType = CipherType.Login,
  deletedDate: string | null = null,
): CipherView {
  const c = new CipherView();
  c.id = id;
  c.name = name;
  c.type = type;
  // CipherView.isDeleted is a getter: `return this.deletedDate != null`
  (c as unknown as Record<string, unknown>).deletedDate = deletedDate;
  return c;
}

describe("OrgCiphersService", () => {
  let service: OrgCiphersService;
  let cipherService: MockProxy<CipherService>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: { activeAccount$: BehaviorSubject<{ id: UserId }> };

  const activeAccount$ = new BehaviorSubject<{ id: UserId }>({ id: USER_ID });

  function makeOrg(canEditAllCiphers: boolean): Organization {
    return { id: ORG_ID, canEditAllCiphers } as Organization;
  }

  beforeEach(() => {
    cipherService = mock<CipherService>();
    organizationService = mock<OrganizationService>();
    accountService = { activeAccount$ };

    organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(false)]));

    TestBed.configureTestingModule({
      providers: [
        OrgCiphersService,
        { provide: CipherService, useValue: cipherService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
      ],
    });

    service = TestBed.inject(OrgCiphersService);
  });

  describe("load", () => {
    it("calls getManyFromApiForOrganization when canEditAllCiphers is false", async () => {
      organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(false)]));
      cipherService.getManyFromApiForOrganization.mockResolvedValue([
        makeCipher("c-1", "My Login"),
      ]);

      await service.load(ORG_ID);

      expect(cipherService.getManyFromApiForOrganization).toHaveBeenCalledWith(ORG_ID);
      expect(cipherService.getAllFromApiForOrganization).not.toHaveBeenCalled();
    });

    it("calls getAllFromApiForOrganization when canEditAllCiphers is true", async () => {
      organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(true)]));
      cipherService.getAllFromApiForOrganization.mockResolvedValue([
        makeCipher("c-2", "Admin Login"),
      ]);

      await service.load(ORG_ID);

      expect(cipherService.getAllFromApiForOrganization).toHaveBeenCalledWith(ORG_ID);
    });

    it("filters out non-Login ciphers", async () => {
      organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(false)]));
      cipherService.getManyFromApiForOrganization.mockResolvedValue([
        makeCipher("c-login", "Login", CipherType.Login),
        makeCipher("c-note", "Note", CipherType.SecureNote),
        makeCipher("c-card", "Card", CipherType.Card),
      ]);

      await service.load(ORG_ID);

      const ciphers = await firstValueFrom(service.ciphers$);
      expect(ciphers).toHaveLength(1);
      expect(ciphers[0].id).toBe("c-login");
    });

    it("filters out deleted (soft-deleted) ciphers", async () => {
      organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(false)]));
      cipherService.getManyFromApiForOrganization.mockResolvedValue([
        makeCipher("c-live", "Live Login", CipherType.Login, null),
        makeCipher("c-deleted", "Deleted Login", CipherType.Login, "2024-01-01T00:00:00Z"),
      ]);

      await service.load(ORG_ID);

      const ciphers = await firstValueFrom(service.ciphers$);
      expect(ciphers).toHaveLength(1);
      expect(ciphers[0].id).toBe("c-live");
    });

    it("exposes ciphers via cipherNameById$ as a Map of id to name", async () => {
      organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(false)]));
      cipherService.getManyFromApiForOrganization.mockResolvedValue([
        makeCipher("c-a", "Alpha"),
        makeCipher("c-b", "Bravo"),
      ]);

      await service.load(ORG_ID);

      const nameById = await firstValueFrom(service.cipherNameById$);
      expect(nameById.get(asUuid<CipherId>(id("c-a")))).toBe("Alpha");
      expect(nameById.get(asUuid<CipherId>(id("c-b")))).toBe("Bravo");
    });

    it("sets loading$ to false after load completes", async () => {
      organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(false)]));
      cipherService.getManyFromApiForOrganization.mockResolvedValue([]);

      await service.load(ORG_ID);

      const loading = await firstValueFrom(service.loading$);
      expect(loading).toBe(false);
    });

    it("sets loading$ to false even when an error occurs", async () => {
      organizationService.organizations$.mockReturnValue(new BehaviorSubject([makeOrg(false)]));
      cipherService.getManyFromApiForOrganization.mockRejectedValue(new Error("network error"));

      await expect(service.load(ORG_ID)).rejects.toThrow("network error");

      const loading = await firstValueFrom(service.loading$);
      expect(loading).toBe(false);
    });
  });
});
