import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, take, toArray } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import { CipherUse, FillCipherPolicy } from "./abstractions/fill-cipher-policy";
import { RestrictedFillCipherPolicy } from "./restricted-fill-cipher-policy";

const userId = "user-1" as UserId;

const makeCipher = (id: string, type: CipherType) => ({ id, type }) as unknown as CipherView;

describe("RestrictedFillCipherPolicy", () => {
  let inner: MockProxy<FillCipherPolicy>;
  let restrictedSet$: BehaviorSubject<ReadonlySet<CipherType>>;
  let policy: RestrictedFillCipherPolicy;

  const login = makeCipher("login", CipherType.Login);
  const card = makeCipher("card", CipherType.Card);
  const identity = makeCipher("identity", CipherType.Identity);
  const sshKey = makeCipher("ssh", CipherType.SshKey);

  beforeEach(() => {
    inner = mock<FillCipherPolicy>();
    restrictedSet$ = new BehaviorSubject<ReadonlySet<CipherType>>(new Set());
    policy = new RestrictedFillCipherPolicy(inner, {
      restrictedSet$,
    } as unknown as RestrictedItemTypesService);
  });

  describe.each([
    ["ciphers", () => inner.ciphers, () => policy.ciphers(userId, CipherUse.UserFill)],
    [
      "ciphersForIds",
      () => inner.ciphersForIds,
      () => policy.ciphersForIds(userId, ["a"], CipherUse.UserFill),
    ],
    [
      "ciphersForUrl",
      () => inner.ciphersForUrl,
      () => policy.ciphersForUrl("https://example.com", userId, CipherUse.UserFill),
    ],
  ])("%s", (_, innerCall, call) => {
    beforeEach(() => {
      innerCall().mockResolvedValue([login, card, identity, sshKey]);
    });

    it("returns every cipher when nothing is restricted", async () => {
      await expect(call()).resolves.toEqual([login, card, identity, sshKey]);
    });

    it("drops ciphers of restricted types", async () => {
      restrictedSet$.next(new Set([CipherType.Card, CipherType.SshKey]));

      await expect(call()).resolves.toEqual([login, identity]);
    });
  });

  describe.each([
    ["lastLaunchedForUrl", () => inner.lastLaunchedForUrl],
    ["lastUsedForUrl", () => inner.lastUsedForUrl],
  ])("%s", (method, innerCall) => {
    const call = () => policy[method as "lastUsedForUrl"]("https://example.com", userId, true);

    it("returns the cipher when its type is not restricted", async () => {
      innerCall().mockResolvedValue(login);
      restrictedSet$.next(new Set([CipherType.Card]));

      await expect(call()).resolves.toBe(login);
    });

    it("returns undefined when its type is restricted", async () => {
      innerCall().mockResolvedValue(card);
      restrictedSet$.next(new Set([CipherType.Card]));

      await expect(call()).resolves.toBeUndefined();
    });

    it("returns undefined when there is no cipher", async () => {
      innerCall().mockResolvedValue(undefined);

      await expect(call()).resolves.toBeUndefined();
    });
  });

  describe("nextCipherForUrl", () => {
    it("returns undefined when the next cipher's type is restricted", async () => {
      inner.nextCipherForUrl.mockResolvedValue(card);
      restrictedSet$.next(new Set([CipherType.Card]));

      await expect(policy.nextCipherForUrl("https://example.com", userId)).resolves.toBeUndefined();
    });

    it("returns the next cipher otherwise", async () => {
      inner.nextCipherForUrl.mockResolvedValue(login);

      await expect(policy.nextCipherForUrl("https://example.com", userId)).resolves.toBe(login);
    });
  });

  describe("keyboard shortcut rotations", () => {
    it("returns the next card when cards are not restricted", async () => {
      inner.nextCardCipher.mockResolvedValue(card);

      await expect(policy.nextCardCipher(userId)).resolves.toBe(card);
    });

    it("does not offer a card when cards are restricted", async () => {
      restrictedSet$.next(new Set([CipherType.Card]));

      await expect(policy.nextCardCipher(userId)).resolves.toBeUndefined();
      expect(inner.nextCardCipher).not.toHaveBeenCalled();
    });

    it("returns the next identity when identities are not restricted", async () => {
      inner.nextIdentityCipher.mockResolvedValue(identity);
      restrictedSet$.next(new Set([CipherType.Card]));

      await expect(policy.nextIdentityCipher(userId)).resolves.toBe(identity);
    });

    it("does not offer an identity when identities are restricted", async () => {
      restrictedSet$.next(new Set([CipherType.Identity]));

      await expect(policy.nextIdentityCipher(userId)).resolves.toBeUndefined();
      expect(inner.nextIdentityCipher).not.toHaveBeenCalled();
    });
  });

  describe("changed$", () => {
    it("emits when the wrapped policy changes", async () => {
      inner.changed$.mockReturnValue(of(undefined));

      await expect(firstValueFrom(policy.changed$(userId))).resolves.toBeUndefined();
    });

    it("emits again when the restricted types change", async () => {
      inner.changed$.mockReturnValue(of());
      const emissions = firstValueFrom(policy.changed$(userId).pipe(take(2), toArray()));

      restrictedSet$.next(new Set([CipherType.Identity]));

      await expect(emissions).resolves.toHaveLength(2);
    });
  });

  it("delegates rotation advancing and save checks", async () => {
    inner.canOfferSave.mockResolvedValue(false);

    policy.advanceRotation("key");

    expect(inner.advanceRotation).toHaveBeenCalledWith("key");
    await expect(policy.canOfferSave({ uri: "https://example.com" }, userId)).resolves.toBe(false);
  });
});
