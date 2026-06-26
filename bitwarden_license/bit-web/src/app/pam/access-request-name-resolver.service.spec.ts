import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AccessRequestNameResolver,
  ResolvedNames,
  mergeResolvedNames,
} from "./access-request-name-resolver.service";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  describe("resolveNames$", () => {
    it("resolves cipher and collection names from local vault state", async () => {
      cipherService.getAllDecryptedForIds.mockResolvedValue([
        Object.assign(new CipherView(), { id: "cipher-1", name: "Prod DB" }),
      ]);
      collectionService.decryptedCollections$.mockReturnValue(
        of([{ id: "col-1", name: "Production" }] as unknown as CollectionView[]),
      );

      const names = await firstValueFrom(
        resolver.resolveNames$(of([{ cipherId: "cipher-1", collectionId: "col-1" }])),
      );

      expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith("user-current", [
        "cipher-1",
      ]);
      expect(names.cipherNameById.get("cipher-1")).toBe("Prod DB");
      expect(names.collectionNameById.get("col-1")).toBe("Production");
    });

    it("returns empty maps for items absent from vault state", async () => {
      const names = await firstValueFrom(
        resolver.resolveNames$(of([{ cipherId: "cipher-x", collectionId: "col-x" }])),
      );

      expect(names.cipherNameById.get("cipher-x")).toBeUndefined();
      expect(names.collectionNameById.get("col-x")).toBeUndefined();
    });

    it("dedupes cipher ids before fetching", async () => {
      await firstValueFrom(
        resolver.resolveNames$(
          of([
            { cipherId: "c1", collectionId: "col-1" },
            { cipherId: "c1", collectionId: "col-2" },
          ]),
        ),
      );

      expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith("user-current", ["c1"]);
    });

    it("does no work for an empty ref set", async () => {
      const names = await firstValueFrom(resolver.resolveNames$(of([])));

      expect(names.cipherNameById.size).toBe(0);
      expect(cipherService.getAllDecryptedForIds).not.toHaveBeenCalled();
    });

    it("back-fills collection names when collection state warms up after subscribe", async () => {
      // The original bug: rows are held before collection state is warm. Names must fill in when
      // that state emits, without re-resolving the refs.
      const collections$ = new BehaviorSubject<CollectionView[]>([]);
      collectionService.decryptedCollections$.mockReturnValue(collections$);

      const seen: (string | undefined)[] = [];
      const sub = resolver
        .resolveNames$(of([{ cipherId: "cipher-1", collectionId: "col-1" }]))
        .subscribe((names) => seen.push(names.collectionNameById.get("col-1")));

      // The cipher snapshot resolves on a microtask; let it land before asserting.
      await flush();
      // Cold: collection state empty, no name yet.
      expect(seen.at(-1)).toBeUndefined();

      // Collection state warms up after subscribe.
      collections$.next([{ id: "col-1", name: "Production" }] as unknown as CollectionView[]);

      expect(seen.at(-1)).toBe("Production");
      sub.unsubscribe();
    });

    it("does not re-decrypt when the same ref set re-emits", async () => {
      const refs$ = new BehaviorSubject([{ cipherId: "cipher-1", collectionId: "col-1" }]);
      const sub = resolver.resolveNames$(refs$).subscribe();
      await flush();

      // An optimistic status edit re-emits the same requests (same ids); no second decrypt.
      refs$.next([{ cipherId: "cipher-1", collectionId: "col-1" }]);
      await flush();

      expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    });
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

  describe("mergeResolvedNames", () => {
    it("unions two lookups, with the later entries winning on collision", () => {
      const a: ResolvedNames = {
        cipherNameById: new Map([["c1", "First"]]),
        collectionNameById: new Map([["col1", "X"]]),
        cipherById: new Map(),
      };
      const b: ResolvedNames = {
        cipherNameById: new Map([
          ["c1", "Second"],
          ["c2", "Other"],
        ]),
        collectionNameById: new Map([["col2", "Y"]]),
        cipherById: new Map(),
      };

      const merged = mergeResolvedNames(a, b);

      expect(merged.cipherNameById.get("c1")).toBe("Second");
      expect(merged.cipherNameById.get("c2")).toBe("Other");
      expect(merged.collectionNameById.get("col1")).toBe("X");
      expect(merged.collectionNameById.get("col2")).toBe("Y");
    });
  });
});
