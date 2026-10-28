import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { vaultListCiphers$ } from "./vault-list-ciphers";

describe("vaultListCiphers$", () => {
  const userId = "user-1" as UserId;
  const unrestricted = [{ id: "unrestricted" }] as CipherView[];
  const withRestricted = [
    { id: "unrestricted" },
    { id: "restricted", partial: true },
  ] as CipherView[];

  let cipherService: MockProxy<CipherService>;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherService.cipherListViews$.mockReturnValue(of(unrestricted));
    cipherService.cipherListViewsIncludingRestricted$.mockReturnValue(of(withRestricted));
  });

  it("lists restricted ciphers under VFO1", async () => {
    const ciphers = await firstValueFrom(vaultListCiphers$(cipherService, userId, of(true)));

    expect(ciphers).toBe(withRestricted);
    expect(cipherService.cipherListViewsIncludingRestricted$).toHaveBeenCalledWith(userId);
  });

  it("leaves restricted ciphers out of the legacy list", async () => {
    const ciphers = await firstValueFrom(vaultListCiphers$(cipherService, userId, of(false)));

    expect(ciphers).toBe(unrestricted);
    expect(cipherService.cipherListViewsIncludingRestricted$).not.toHaveBeenCalled();
  });

  it("follows the flag when it changes", () => {
    const vfo1Foundation$ = new BehaviorSubject(false);
    const emitted: unknown[] = [];

    const subscription = vaultListCiphers$(cipherService, userId, vfo1Foundation$).subscribe(
      (ciphers) => emitted.push(ciphers),
    );
    vfo1Foundation$.next(true);
    subscription.unsubscribe();

    expect(emitted).toEqual([unrestricted, withRestricted]);
  });
});
