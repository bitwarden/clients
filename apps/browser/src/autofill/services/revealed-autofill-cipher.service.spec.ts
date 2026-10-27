import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { RevealedAutofillCipherService } from "./revealed-autofill-cipher.service";

describe("RevealedAutofillCipherService", () => {
  const userId = "user-id" as UserId;
  const url = "https://example.com";

  let cipherService: MockProxy<CipherService>;
  let revealed$: BehaviorSubject<ReadonlyMap<CipherId, CipherView>>;
  let service: RevealedAutofillCipherService;

  const view = (id: string, revisionDate = new Date(0)) =>
    Object.assign(new CipherView(), { id, revisionDate });
  const reveal = (...views: CipherView[]) =>
    revealed$.next(new Map(views.map((v) => [v.id as CipherId, v])));

  beforeEach(() => {
    jest.useFakeTimers();
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

    service = new RevealedAutofillCipherService(cipherService, revealedCipherService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getAllDecryptedIncludingRevealed", () => {
    it("appends the revealed views to the stored ciphers", async () => {
      reveal(view("revealed"));

      const ciphers = await service.getAllDecryptedIncludingRevealed(userId);

      expect(ciphers.map((c) => c.id)).toEqual(["stored", "revealed"]);
    });

    it("keeps the stored copy over an old revealed view of the same cipher", async () => {
      const stored = view("stored");
      cipherService.getAllDecrypted.mockResolvedValue([stored]);
      reveal(view("stored"));

      const ciphers = await service.getAllDecryptedIncludingRevealed(userId);

      expect(ciphers).toEqual([stored]);
      expect(ciphers[0]).toBe(stored);
    });
  });

  describe("getAllDecryptedForUrlIncludingRevealed", () => {
    it("appends only the revealed views that match the URL", async () => {
      reveal(view("revealed"), view("other-site"));

      const ciphers = await service.getAllDecryptedForUrlIncludingRevealed(url, userId, [
        CipherType.Card,
      ]);

      expect(ciphers.map((c) => c.id)).toEqual(["stored", "revealed"]);
      expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(url, userId, [
        CipherType.Card,
      ]);
      expect(cipherService.filterCiphersForUrl).toHaveBeenCalledWith(expect.any(Array), url, [
        CipherType.Card,
      ]);
    });

    it("returns the stored lookup as it is without revealed views", async () => {
      const ciphers = await service.getAllDecryptedForUrlIncludingRevealed(url, userId);

      expect(ciphers.map((c) => c.id)).toEqual(["stored"]);
      expect(cipherService.filterCiphersForUrl).not.toHaveBeenCalled();
    });
  });

  describe("getNextCipherForUrlIncludingRevealed", () => {
    it("uses the CipherService rotation without revealed views", async () => {
      const next = view("next");
      cipherService.getNextCipherForUrl.mockResolvedValue(next);

      expect(await service.getNextCipherForUrlIncludingRevealed(url, userId)).toBe(next);
      expect(cipherService.getAllDecryptedForUrl).not.toHaveBeenCalled();
    });

    it("rotates through the stored ciphers and the revealed views", async () => {
      reveal(view("revealed"));
      const picked: string[] = [];

      for (let i = 0; i < 3; i++) {
        picked.push((await service.getNextCipherForUrlIncludingRevealed(url, userId))!.id);
        service.updateLastUsedIndexForUrl(url);
      }

      expect(picked).toEqual(["stored", "revealed", "stored"]);
      expect(cipherService.getNextCipherForUrl).not.toHaveBeenCalled();
      expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(url);
    });

    it("restarts the rotation when a revealed view ends", async () => {
      reveal(view("revealed"), view("second"));
      await service.getNextCipherForUrlIncludingRevealed(url, userId);
      service.updateLastUsedIndexForUrl(url);

      reveal(view("second"));
      const next = await service.getNextCipherForUrlIncludingRevealed(url, userId);

      expect(next?.id).toBe("stored");
    });

    it("returns undefined when nothing matches the URL", async () => {
      cipherService.getAllDecryptedForUrl.mockResolvedValue([]);
      reveal(view("other-site"));

      expect(await service.getNextCipherForUrlIncludingRevealed(url, userId)).toBeUndefined();
    });
  });
});
