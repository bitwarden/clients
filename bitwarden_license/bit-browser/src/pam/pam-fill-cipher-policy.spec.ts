import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Subject, take, toArray } from "rxjs";

import { CipherUse } from "@bitwarden/browser/autofill/services/abstractions/fill-cipher-policy";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { PamFillCipherPolicy } from "./pam-fill-cipher-policy";

describe("PamFillCipherPolicy", () => {
  const userId = "user-id" as UserId;
  const url = "https://example.com";

  let cipherService: MockProxy<CipherService>;
  let revealed$: BehaviorSubject<ReadonlyMap<CipherId, CipherView>>;
  let policy: PamFillCipherPolicy;

  const view = (id: string, revisionDate = new Date(0)) =>
    Object.assign(new CipherView(), { id, revisionDate });
  const reveal = (...views: CipherView[]) =>
    revealed$.next(new Map(views.map((v) => [v.id as CipherId, v])));

  const otherUses = Object.values(CipherUse).filter((use) => use !== CipherUse.UserFill);

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherService.getAllDecrypted.mockResolvedValue([view("stored")]);
    cipherService.getAllDecryptedForUrl.mockResolvedValue([view("stored")]);
    cipherService.filterCiphersForUrl.mockImplementation(async (ciphers) =>
      ciphers.filter((c) => c.id !== "other-site"),
    );
    cipherService.sortCiphersByLastUsed.mockReturnValue(0);
    revealed$ = new BehaviorSubject<ReadonlyMap<CipherId, CipherView>>(new Map());
    const revealedCipherService = mock<RevealedCipherService>();
    revealedCipherService.revealed$.mockReturnValue(revealed$);

    policy = new PamFillCipherPolicy(cipherService, revealedCipherService);
  });

  describe("changed$", () => {
    it("emits for stored cipher changes and revealed view changes", async () => {
      const ciphers$ = new Subject<Record<CipherId, CipherData>>();
      cipherService.ciphers$.mockReturnValue(ciphers$);

      const emitted = firstValueFrom(policy.changed$(userId).pipe(take(3), toArray()));
      ciphers$.next({});
      reveal(view("revealed"));

      expect(await emitted).toEqual([undefined, undefined, undefined]);
    });
  });

  describe("ciphers", () => {
    it("appends the revealed views to the stored ciphers for a user fill", async () => {
      reveal(view("revealed"));

      const ciphers = await policy.ciphers(userId, CipherUse.UserFill);

      expect(ciphers.map((c) => c.id)).toEqual(["stored", "revealed"]);
    });

    it("keeps the stored copy over an old revealed view of the same cipher", async () => {
      const stored = view("stored");
      cipherService.getAllDecrypted.mockResolvedValue([stored]);
      reveal(view("stored"));

      const ciphers = await policy.ciphers(userId, CipherUse.UserFill);

      expect(ciphers).toEqual([stored]);
      expect(ciphers[0]).toBe(stored);
    });

    it.each(otherUses)("returns only the stored ciphers for %s", async (use) => {
      reveal(view("revealed"));

      const ciphers = await policy.ciphers(userId, use);

      expect(ciphers.map((c) => c.id)).toEqual(["stored"]);
    });
  });

  describe("ciphersForUrl", () => {
    it("appends only the revealed views that match the URL for a user fill", async () => {
      reveal(view("revealed"), view("other-site"));

      const ciphers = await policy.ciphersForUrl(url, userId, CipherUse.UserFill, {
        includeOtherTypes: [CipherType.Card],
      });

      expect(ciphers.map((c) => c.id)).toEqual(["stored", "revealed"]);
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
        url,
        userId,
        [CipherType.Card],
        undefined,
      );
      expect(cipherService.filterCiphersForUrl).toHaveBeenCalledWith(
        expect.any(Array),
        url,
        [CipherType.Card],
        undefined,
      );
    });

    it("returns the stored lookup as it is without revealed views", async () => {
      const ciphers = await policy.ciphersForUrl(url, userId, CipherUse.UserFill);

      expect(ciphers.map((c) => c.id)).toEqual(["stored"]);
      expect(cipherService.filterCiphersForUrl).not.toHaveBeenCalled();
    });

    it.each(otherUses)("returns only the stored ciphers for %s", async (use) => {
      reveal(view("revealed"));

      const ciphers = await policy.ciphersForUrl(url, userId, use);

      expect(ciphers.map((c) => c.id)).toEqual(["stored"]);
      expect(cipherService.filterCiphersForUrl).not.toHaveBeenCalled();
    });
  });

  describe("lastLaunchedForUrl and lastUsedForUrl", () => {
    it("return the stored cipher, not a revealed view", async () => {
      reveal(view("revealed"));
      const stored = view("stored");
      cipherService.getLastLaunchedForUrl.mockResolvedValue(stored);
      cipherService.getLastUsedForUrl.mockResolvedValue(stored);

      expect(await policy.lastLaunchedForUrl(url, userId, true)).toBe(stored);
      expect(await policy.lastUsedForUrl(url, userId, true)).toBe(stored);
    });
  });

  describe("nextCipherForUrl", () => {
    it("uses the CipherService rotation without revealed views", async () => {
      const next = view("next");
      cipherService.getNextCipherForUrl.mockResolvedValue(next);

      expect(await policy.nextCipherForUrl(url, userId)).toBe(next);
      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
    });

    it("rotates through the stored ciphers and the revealed views", async () => {
      reveal(view("revealed"));
      const picked: string[] = [];

      for (let i = 0; i < 3; i++) {
        picked.push((await policy.nextCipherForUrl(url, userId))!.id);
        policy.advanceRotation(url);
      }

      expect(picked).toEqual(["stored", "revealed", "stored"]);
      expect(cipherService.getNextCipherForUrl).not.toHaveBeenCalled();
      expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(url);
    });

    it("restarts the rotation when a revealed view ends", async () => {
      reveal(view("revealed"), view("second"));
      await policy.nextCipherForUrl(url, userId);
      policy.advanceRotation(url);

      reveal(view("second"));
      const next = await policy.nextCipherForUrl(url, userId);

      expect(next?.id).toBe("stored");
    });

    it("returns undefined when nothing matches the URL", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);
      reveal(view("other-site"));

      expect(await policy.nextCipherForUrl(url, userId)).toBeUndefined();
    });
  });

  describe("canOfferSave", () => {
    beforeEach(() => {
      reveal(
        Object.assign(view("revealed"), {
          login: { username: "Admin", password: "revealed" },
        }),
      );
      cipherService.filterCiphersForUrl.mockImplementation(async (ciphers, ciphersUrl) =>
        ciphersUrl === url ? ciphers : [],
      );
    });

    it.each([
      [false, "the revealed username, in any case", { username: "ADMIN", password: "other" }],
      [false, "a password-only form", { username: "", password: "revealed" }],
      [
        false,
        "a change-password form with no username",
        { password: "old", newPassword: "revealed" },
      ],
      [true, "another username and password", { username: "other", password: "other" }],
      [true, "another site", { username: "Admin", password: "revealed", uri: "https://other.com" }],
    ])("is %s for %s", async (expected, _, form) => {
      const data = { uri: url, username: "", password: "", ...form };

      expect(await policy.canOfferSave(data, userId)).toBe(expected);
    });

    it("is true without revealed views", async () => {
      reveal();

      expect(await policy.canOfferSave({ uri: url, username: "Admin" }, userId)).toBe(true);
    });
  });
});
