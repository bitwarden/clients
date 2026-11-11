import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, Subject, toArray } from "rxjs";

import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherUse } from "./abstractions/fill-cipher-policy";
import { DefaultFillCipherPolicy } from "./default-fill-cipher-policy";

describe("DefaultFillCipherPolicy", () => {
  const userId = "user-id" as UserId;
  const url = "https://example.com";

  let cipherService: MockProxy<CipherService>;
  let policy: DefaultFillCipherPolicy;

  const view = (id: string) => Object.assign(new CipherView(), { id });

  beforeEach(() => {
    cipherService = mock<CipherService>();
    policy = new DefaultFillCipherPolicy(cipherService);
  });

  it("emits changed$ after each decryption and not while decryption is in progress", async () => {
    const listViews$ = new Subject<CipherView[] | null>();
    cipherService.cipherListViews$.mockReturnValue(listViews$);

    const emitted = firstValueFrom(policy.changed$(userId).pipe(toArray()));
    listViews$.next([view("a")]);
    listViews$.next(null);
    listViews$.next([view("b")]);
    listViews$.complete();

    expect(await emitted).toEqual([undefined, undefined]);
    expect(cipherService.cipherListViews$).toHaveBeenCalledWith(userId);
  });

  it("watches list views for changed$, so the background never decrypts the whole vault", () => {
    cipherService.cipherListViews$.mockReturnValue(new Subject<CipherView[] | null>());

    policy.changed$(userId).subscribe();

    expect(cipherService.cipherViews$).not.toHaveBeenCalled();
  });

  it.each(Object.values(CipherUse))("returns the stored ciphers for %s", async (use) => {
    const stored = [view("stored")];
    cipherService.getAllDecrypted.mockResolvedValue(stored);

    expect(await policy.ciphers(userId, use)).toBe(stored);
  });

  it("decrypts only the requested ids", async () => {
    const stored = [view("a")];
    cipherService.getAllDecryptedForIds.mockResolvedValue(stored);

    expect(await policy.ciphersForIds(userId, ["a"], CipherUse.UserFill)).toBe(stored);
    expect(cipherService.getAllDecryptedForIds).toHaveBeenCalledWith(userId, ["a"]);
    expect(cipherService.getAllDecrypted).not.toHaveBeenCalled();
  });

  it("passes the URL options to the stored lookup", async () => {
    const stored = [view("stored")];
    cipherService.getAllDecryptedForUrl.mockResolvedValue(stored);

    const ciphers = await policy.ciphersForUrl(url, userId, CipherUse.AutomaticFill, {
      includeOtherTypes: [CipherType.Card],
      defaultMatch: UriMatchStrategy.Host,
    });

    expect(ciphers).toBe(stored);
    expect(cipherService.getAllDecryptedForUrl).toHaveBeenCalledWith(
      url,
      userId,
      [CipherType.Card],
      UriMatchStrategy.Host,
    );
  });

  it.each([
    ["lastLaunchedForUrl", "getLastLaunchedForUrl"],
    ["lastUsedForUrl", "getLastUsedForUrl"],
  ] as const)("%s returns undefined for no match", async (method, delegate) => {
    cipherService[delegate].mockResolvedValue(null);

    expect(await policy[method](url, userId, true)).toBeUndefined();
    expect(cipherService[delegate]).toHaveBeenCalledWith(url, userId, true);
  });

  it("returns the next cipher of the stored rotation", async () => {
    const next = view("next");
    cipherService.getNextCipherForUrl.mockResolvedValue(next);

    expect(await policy.nextCipherForUrl(url, userId)).toBe(next);
  });

  it("returns undefined when the stored rotation is empty", async () => {
    cipherService.getNextCipherForUrl.mockResolvedValue(null);

    expect(await policy.nextCipherForUrl(url, userId)).toBeUndefined();
  });

  it.each([
    ["nextCardCipher", "getNextCardCipher"],
    ["nextIdentityCipher", "getNextIdentityCipher"],
  ] as const)("%s returns the next cipher of the stored rotation", async (method, delegate) => {
    const next = view("next");
    cipherService[delegate].mockResolvedValue(next);

    expect(await policy[method](userId)).toBe(next);
    expect(cipherService[delegate]).toHaveBeenCalledWith(userId);
  });

  it.each([
    ["nextCardCipher", "getNextCardCipher"],
    ["nextIdentityCipher", "getNextIdentityCipher"],
  ] as const)(
    "%s returns undefined when the stored rotation is empty",
    async (method, delegate) => {
      cipherService[delegate].mockResolvedValue(null);

      expect(await policy[method](userId)).toBeUndefined();
    },
  );

  it("advances the stored rotation", () => {
    policy.advanceRotation(url);

    expect(cipherService.updateLastUsedIndexForUrl).toHaveBeenCalledWith(url);
  });

  it("always offers to save", async () => {
    expect(await policy.canOfferSave({ uri: url, username: "user" }, userId)).toBe(true);
  });
});
