import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AccessRequestDetailsResponse } from "@bitwarden/bit-pam";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

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
      new BehaviorSubject<unknown>({ id: "user-current", email: "me@example.com" });

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

    it("exposes the decrypted cipher views by id for favicon rendering", async () => {
      const view = Object.assign(new CipherView(), { id: "cipher-1", name: "Prod DB" });
      cipherService.getAllDecryptedForIds.mockResolvedValue([view]);

      const { cipherById } = await resolver.namesFor([
        { cipherId: "cipher-1", collectionId: "col-1" },
      ]);

      expect(cipherById.get("cipher-1")).toBe(view);
    });

    it("returns empty maps and touches no services for an empty list", async () => {
      const { cipherNameById, collectionNameById, cipherById } = await resolver.namesFor([]);

      expect(cipherNameById.size).toBe(0);
      expect(collectionNameById.size).toBe(0);
      expect(cipherById.size).toBe(0);
      expect(cipherService.getAllDecryptedForIds).not.toHaveBeenCalled();
    });
  });

  it("returns the resolved cipher views from resolveDisplayNames", async () => {
    const view = Object.assign(new CipherView(), { id: "cipher-1", name: "Prod DB" });
    cipherService.getAllDecryptedForIds.mockResolvedValue([view]);

    const { cipherById } = await resolver.resolveDisplayNames([
      makeRow({ cipherId: "cipher-1", collectionId: "col-1" }),
    ]);

    expect(cipherById.get("cipher-1")).toBe(view);
  });

  describe("applyCollectionNames$", () => {
    it("back-fills collection names when collection state warms up after subscribe", () => {
      // The original bug: rows are held before collection state is warm. Names must fill in when
      // that state emits, without re-loading the rows.
      const collections$ = new BehaviorSubject<CollectionView[]>([]);
      collectionService.decryptedCollections$.mockReturnValue(collections$);
      const rows$ = new BehaviorSubject([makeRow({ collectionId: "col-1" })]);

      const seen: (string | null)[] = [];
      const sub = resolver
        .applyCollectionNames$(rows$)
        .subscribe((rows) => seen.push(rows[0].collectionName));

      // Cold: collection state empty, no name yet — but the rows still emitted (cipher names paint).
      expect(seen.at(-1)).toBeNull();

      // Collection state warms up after subscribe.
      collections$.next([{ id: "col-1", name: "Production" }] as unknown as CollectionView[]);

      expect(seen.at(-1)).toBe("Production");
      sub.unsubscribe();
    });

    it("applies names to rows that arrive after collection state is already warm", () => {
      collectionService.decryptedCollections$.mockReturnValue(
        of([{ id: "col-1", name: "Production" }] as unknown as CollectionView[]),
      );
      const rows$ = new BehaviorSubject([makeRow({ id: "a", collectionId: "col-1" })]);

      const seen: (string | null)[] = [];
      const sub = resolver
        .applyCollectionNames$(rows$)
        .subscribe((rows) => seen.push(rows[0]?.collectionName ?? null));
      expect(seen.at(-1)).toBe("Production");

      // A reload swaps in fresh rows; names apply without re-warming collection state.
      rows$.next([makeRow({ id: "b", collectionId: "col-1" })]);

      expect(seen.at(-1)).toBe("Production");
      sub.unsubscribe();
    });
  });
});
