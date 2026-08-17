import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessNameResolverService, emptyResolvedNames } from "./access-name-resolver.service";

const USER_ID = "user-current" as UserId;

function cipherView(id: string, name: string): CipherView {
  return Object.assign(new CipherView(), { id, name });
}

function collectionViews(entries: Array<[string, string]>): CollectionView[] {
  return entries.map(([id, name]) => ({ id, name })) as unknown as CollectionView[];
}

describe("AccessNameResolverService", () => {
  let service: AccessNameResolverService;
  // Narrowed to the two methods the service calls, so the mock says exactly what it depends on.
  let cipherService: jest.Mocked<Pick<CipherService, "getAllDecryptedForIds">>;
  let collections$: BehaviorSubject<CollectionView[]>;

  beforeEach(() => {
    cipherService = { getAllDecryptedForIds: jest.fn().mockResolvedValue([]) } as jest.Mocked<
      Pick<CipherService, "getAllDecryptedForIds">
    >;
    collections$ = new BehaviorSubject<CollectionView[]>([]);

    TestBed.configureTestingModule({
      providers: [
        AccessNameResolverService,
        { provide: AccountService, useValue: { activeAccount$: of({ id: USER_ID }) } },
        { provide: CipherService, useValue: cipherService },
        { provide: CollectionService, useValue: { decryptedCollections$: () => collections$ } },
      ],
    });
    service = TestBed.inject(AccessNameResolverService);
  });

  it("resolves cipher and collection names from local vault state", async () => {
    cipherService.getAllDecryptedForIds.mockResolvedValue([
      cipherView("cipher-1", "Prod database"),
    ]);
    collections$.next(collectionViews([["col-1", "Production"]]));

    const names = await service.resolveNames([{ cipherId: "cipher-1", collectionId: "col-1" }]);

    expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith(USER_ID, ["cipher-1"]);
    expect(names.cipherNameById.get("cipher-1")).toBe("Prod database");
    expect(names.collectionNameById.get("col-1")).toBe("Production");
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

    expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith(USER_ID, ["cipher-1"]);
  });

  it("does no work at all for an empty ref set", async () => {
    const names = await service.resolveNames([]);

    expect(names).toEqual(emptyResolvedNames());
    expect(cipherService.getAllDecryptedForIds).not.toHaveBeenCalled();
  });

  it("exposes the decrypted views themselves, by identity, for favicon rendering", async () => {
    const view = cipherView("cipher-1", "Prod database");
    cipherService.getAllDecryptedForIds.mockResolvedValue([view]);

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

    expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith(USER_ID, expect.anything());
  });
});
