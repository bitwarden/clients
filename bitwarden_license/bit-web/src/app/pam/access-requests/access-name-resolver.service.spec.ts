import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessNameResolverService, emptyResolvedNames } from "./access-name-resolver.service";

const USER_ID = "user-current" as UserId;

function cipherView(id: string, name: string, partial = false): CipherView {
  return Object.assign(new CipherView(), { id, name, partial });
}

function collectionViews(entries: Array<[string, string]>): CollectionView[] {
  return entries.map(([id, name]) => ({ id, name })) as unknown as CollectionView[];
}

function organizations(entries: Array<[string, string]>): Organization[] {
  return entries.map(([id, name]) => ({ id, name })) as unknown as Organization[];
}

describe("AccessNameResolverService", () => {
  let service: AccessNameResolverService;
  // Narrowed to the one method the service calls, so the mock says exactly what it depends on.
  let cipherService: jest.Mocked<Pick<CipherService, "getAllDecryptedForIdsIncludingPartials">>;
  let collections$: BehaviorSubject<CollectionView[]>;
  let organizations$: BehaviorSubject<Organization[]>;

  beforeEach(() => {
    cipherService = {
      getAllDecryptedForIdsIncludingPartials: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<Pick<CipherService, "getAllDecryptedForIdsIncludingPartials">>;
    collections$ = new BehaviorSubject<CollectionView[]>([]);
    organizations$ = new BehaviorSubject<Organization[]>([]);

    TestBed.configureTestingModule({
      providers: [
        AccessNameResolverService,
        { provide: AccountService, useValue: { activeAccount$: of({ id: USER_ID }) } },
        { provide: CipherService, useValue: cipherService },
        { provide: CollectionService, useValue: { decryptedCollections$: () => collections$ } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
      ],
    });
    service = TestBed.inject(AccessNameResolverService);
  });

  it("resolves cipher and collection names from local vault state", async () => {
    cipherService.getAllDecryptedForIdsIncludingPartials.mockResolvedValue([
      cipherView("cipher-1", "Prod database"),
    ]);
    collections$.next(collectionViews([["col-1", "Production"]]));

    const names = await service.resolveNames([{ cipherId: "cipher-1", collectionId: "col-1" }]);

    expect(cipherService.getAllDecryptedForIdsIncludingPartials).toHaveBeenCalledWith(USER_ID, [
      "cipher-1",
    ]);
    expect(names.cipherNameById.get("cipher-1")).toBe("Prod database");
    expect(names.collectionNameById.get("col-1")).toBe("Production");
  });

  it("keys every organization the caller belongs to, since a ref carries no organization id", async () => {
    organizations$.next(
      organizations([
        ["org-1", "Meridian Group"],
        ["org-2", "Northwind"],
      ]),
    );

    const names = await service.resolveNames([{ cipherId: "cipher-1", collectionId: "col-1" }]);

    expect(names.organizationNameById.get("org-1")).toBe("Meridian Group");
    expect(names.organizationNameById.get("org-2")).toBe("Northwind");
  });

  it("leaves an organization the caller does not belong to absent", async () => {
    const names = await service.resolveNames([{ cipherId: "cipher-1", collectionId: "col-1" }]);

    expect(names.organizationNameById.get("org-9")).toBeUndefined();
  });

  it("resolves names for PAM-gated (partial) ciphers", async () => {
    // The whole point of this service: every id it is asked about names a gated cipher, so it must
    // read the partial-inclusive accessor. Reading `getAllDecryptedForIds`/`cipherViews$` instead
    // strips exactly these rows and the lists fall back to raw uuids.
    cipherService.getAllDecryptedForIdsIncludingPartials.mockResolvedValue([
      cipherView("cipher-gated", "AWS Root Account", true),
    ]);

    const names = await service.resolveNames([{ cipherId: "cipher-gated", collectionId: "col-1" }]);

    expect(names.cipherNameById.get("cipher-gated")).toBe("AWS Root Account");
  });

  it("leaves ids the caller cannot resolve absent rather than guessing a name", async () => {
    // An approver often cannot see the item they are granting access to; callers fall back to the id.
    const names = await service.resolveNames([{ cipherId: "cipher-9", collectionId: "col-9" }]);

    expect(names.cipherNameById.get("cipher-9")).toBeUndefined();
    expect(names.collectionNameById.get("col-9")).toBeUndefined();
  });

  it("dedupes cipher ids before decrypting", async () => {
    // Several requests for the same item are common; decrypting it once is the point.
    await service.resolveNames([
      { cipherId: "cipher-1", collectionId: "col-1" },
      { cipherId: "cipher-1", collectionId: "col-2" },
    ]);

    expect(cipherService.getAllDecryptedForIdsIncludingPartials).toHaveBeenCalledWith(USER_ID, [
      "cipher-1",
    ]);
  });

  it("does no work at all for an empty ref set", async () => {
    const names = await service.resolveNames([]);

    expect(names).toEqual(emptyResolvedNames());
    expect(cipherService.getAllDecryptedForIdsIncludingPartials).not.toHaveBeenCalled();
  });

  it("exposes the decrypted views themselves, by identity, for favicon rendering", async () => {
    const view = cipherView("cipher-1", "Prod database");
    cipherService.getAllDecryptedForIdsIncludingPartials.mockResolvedValue([view]);

    const names = await service.resolveNames([{ cipherId: "cipher-1", collectionId: "col-1" }]);

    expect(names.cipherById.get("cipher-1")).toBe(view);
  });

  it("picks up collection state that warmed up after an earlier resolve", async () => {
    // The poc needed a reactive back-fill for this; here every fetch re-resolves, so a later call
    // simply sees the warm state. That is why this service is a plain one-shot promise.
    const refs = [{ cipherId: "cipher-1", collectionId: "col-1" }];
    expect((await service.resolveNames(refs)).collectionNameById.get("col-1")).toBeUndefined();

    collections$.next(collectionViews([["col-1", "Production"]]));

    expect((await service.resolveNames(refs)).collectionNameById.get("col-1")).toBe("Production");
  });

  it("resolves against the active user", async () => {
    await service.resolveNames([{ cipherId: "cipher-1", collectionId: "col-1" }]);

    expect(cipherService.getAllDecryptedForIdsIncludingPartials).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
  });
});
