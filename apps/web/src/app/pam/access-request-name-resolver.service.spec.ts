import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AccessRequestDetailsResponse } from "@bitwarden/pam";

import { AccessRequestNameResolver } from "./access-request-name-resolver.service";

function makeRow(
  overrides: Partial<{ id: string; cipherId: string; collectionId: string }> = {},
): AccessRequestDetailsResponse {
  return new AccessRequestDetailsResponse({
    Id: overrides.id ?? "req-1",
    CipherId: overrides.cipherId ?? "cipher-1",
    CollectionId: overrides.collectionId ?? "col-1",
    OrganizationId: "org-1",
    RequesterUserId: "user-2",
    Status: "pending",
    RequestedTtlSeconds: 3600,
    SubmittedAt: "2026-05-15T12:00:00Z",
  });
}

describe("AccessRequestNameResolver", () => {
  let cipherService: jest.Mocked<Pick<CipherService, "getAllDecryptedForIds">>;
  let collectionService: jest.Mocked<Pick<CollectionService, "decryptedCollections$">>;
  let resolver: AccessRequestNameResolver;

  beforeEach(() => {
    cipherService = {
      getAllDecryptedForIds: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<Pick<CipherService, "getAllDecryptedForIds">>;

    collectionService = {
      decryptedCollections$: jest.fn().mockReturnValue(of([])),
    } as jest.Mocked<Pick<CollectionService, "decryptedCollections$">>;

    const accountService = mock<AccountService>();
    (accountService as unknown as { activeAccount$: BehaviorSubject<unknown> }).activeAccount$ =
      new BehaviorSubject({ id: "user-current", email: "me@example.com" });

    TestBed.configureTestingModule({
      providers: [
        AccessRequestNameResolver,
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: cipherService },
        { provide: CollectionService, useValue: collectionService },
      ],
    });

    resolver = TestBed.inject(AccessRequestNameResolver);
  });

  it("resolves cipher and collection names in place from local vault state", async () => {
    const row = makeRow({ cipherId: "cipher-1", collectionId: "col-1" });
    cipherService.getAllDecryptedForIds.mockResolvedValue([
      Object.assign(new CipherView(), { id: "cipher-1", name: "Prod DB" }),
    ]);
    collectionService.decryptedCollections$.mockReturnValue(
      of([{ id: "col-1", name: "Production" }] as unknown as CollectionView[]),
    );

    await resolver.resolveDisplayNames([row]);

    expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith("user-current", ["cipher-1"]);
    expect(row.cipherName).toBe("Prod DB");
    expect(row.collectionName).toBe("Production");
  });

  it("falls back to the cipher id and a null collection when the item is absent from vault state", async () => {
    const row = makeRow({ cipherId: "cipher-x" });

    await resolver.resolveDisplayNames([row]);

    expect(row.cipherName).toBe("cipher-x");
    expect(row.collectionName).toBeNull();
  });

  it("dedupes cipher ids before fetching", async () => {
    await resolver.resolveDisplayNames([
      makeRow({ id: "a", cipherId: "c1" }),
      makeRow({ id: "b", cipherId: "c1" }),
    ]);

    expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith("user-current", ["c1"]);
  });

  it("does no work for an empty list", async () => {
    await resolver.resolveDisplayNames([]);

    expect(cipherService.getAllDecryptedForIds).not.toHaveBeenCalled();
    expect(collectionService.decryptedCollections$).not.toHaveBeenCalled();
  });

  describe("namesFor", () => {
    it("returns lookup maps for arbitrary cipher/collection refs", async () => {
      cipherService.getAllDecryptedForIds.mockResolvedValue([
        Object.assign(new CipherView(), { id: "cipher-1", name: "Prod DB" }),
      ]);
      collectionService.decryptedCollections$.mockReturnValue(
        of([{ id: "col-1", name: "Production" }] as unknown as CollectionView[]),
      );

      const { cipherNameById, collectionNameById } = await resolver.namesFor([
        { cipherId: "cipher-1", collectionId: "col-1" },
      ]);

      expect(cipherNameById.get("cipher-1")).toBe("Prod DB");
      expect(collectionNameById.get("col-1")).toBe("Production");
    });

    it("returns empty maps and touches no services for an empty list", async () => {
      const { cipherNameById, collectionNameById } = await resolver.namesFor([]);

      expect(cipherNameById.size).toBe(0);
      expect(collectionNameById.size).toBe(0);
      expect(cipherService.getAllDecryptedForIds).not.toHaveBeenCalled();
    });
  });
});
