import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CipherListView, PasswordManagerClient } from "@bitwarden/sdk-internal";

import { mockAccountServiceWith } from "../../../../spec";
import { AccountService } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { CipherType } from "../../../vault/enums";
import { CipherData } from "../../../vault/models/data/cipher.data";
import { Cipher } from "../../../vault/models/domain/cipher";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { LoginView } from "../../../vault/models/view/login.view";
import { SdkService } from "../../abstractions/sdk/sdk.service";
import { Rc } from "../../misc/reference-counting/rc";

import { parseCredentialId } from "./credential-id-utils";
import { SdkFido2CredentialStore } from "./sdk-fido2-credential-store";

/** Cipher ids have to be real UUIDs: `toSdkCipherView` validates them. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ID = {
  match: uuid(1),
  hidden: uuid(2),
  wrongRp: uuid(3),
  deleted: uuid(4),
  notALogin: uuid(5),
  noPasskey: uuid(6),
  keeper: uuid(7),
  other: uuid(8),
  secondOnly: uuid(9),
};

const RP_ID = "bitwarden.com";
const OTHER_RP_ID = "example.com";
const USER_ID = "00000000-0000-0000-0000-000000000000" as UserId;

/** A credential id in the guid form the vault stores. */
const CREDENTIAL_ID = "d548e0e0-4b8e-4f0e-9e26-1c4d5f6a7b8c";
const OTHER_CREDENTIAL_ID = "a1b2c3d4-1111-2222-3333-444455556666";

function makePasskeyCipher(options: {
  id: string;
  rpId?: string;
  credentialId?: string;
  discoverable?: boolean;
  deleted?: boolean;
  type?: CipherType;
  extraCredentials?: Fido2CredentialView[];
}): CipherView {
  const cipher = new CipherView();
  cipher.id = options.id;
  cipher.type = options.type ?? CipherType.Login;
  cipher.deletedDate = options.deleted ? new Date() : undefined;
  cipher.login = new LoginView();

  const credential = new Fido2CredentialView();
  credential.credentialId = options.credentialId ?? CREDENTIAL_ID;
  credential.rpId = options.rpId ?? RP_ID;
  credential.discoverable = options.discoverable ?? true;
  cipher.login.fido2Credentials = [credential, ...(options.extraCredentials ?? [])];

  return cipher;
}

function makeNonPasskeyCipher(id: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.type = CipherType.Login;
  cipher.login = new LoginView();
  cipher.login.fido2Credentials = [];
  return cipher;
}

describe("SdkFido2CredentialStore", () => {
  let cipherService: MockProxy<CipherService>;
  let accountService: AccountService;
  let sdkService: MockProxy<SdkService>;
  let store: SdkFido2CredentialStore;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    accountService = mockAccountServiceWith(USER_ID);
    sdkService = mock<SdkService>();
    store = new SdkFido2CredentialStore(cipherService, accountService, sdkService);

    // `find_credentials` re-reads each match through the SDK's own decrypt, so even the filter
    // tests need a client. Echoing the cipher back keeps them about the filter rules.
    const client = mock<PasswordManagerClient>();
    client.vault.mockReturnValue({
      ciphers: () => ({ decrypt: async (cipher: { id: string }) => ({ id: cipher.id }) }),
    } as never);
    sdkService.userClient$.mockReturnValue(of(new Rc(client)));
  });

  /** The two dates are required: `toSdkCipher` calls `toISOString()` on both. */
  function cipherData(id: string): CipherData {
    return {
      id,
      type: CipherType.Login,
      revisionDate: "2024-01-01T00:00:00.000Z",
      creationDate: "2024-01-01T00:00:00.000Z",
      login: { uris: [] },
    } as unknown as CipherData;
  }

  function stateHolds(...ids: string[]) {
    cipherService.ciphers$.mockReturnValue(
      of(Object.fromEntries(ids.map((id) => [id, cipherData(id)]))) as never,
    );
  }

  /**
   * Every cipher the vault holds, decrypted and encrypted.
   *
   * Both are needed: the filter runs over the decrypted views, and the SDK re-read looks the
   * matches back up in state by id.
   */
  function vaultHolds(ciphers: CipherView[]) {
    cipherService.getAllDecrypted.mockResolvedValue(ciphers);
    stateHolds(...ciphers.map((cipher) => cipher.id).filter((id) => id != null));
  }

  /** Returns the ids the store selected, which is what the filter rules are really about. */
  async function findIds(ids: number[][] | undefined, rpId = RP_ID) {
    const found = await store.find_credentials(ids, rpId, undefined);
    return found.map((cipher) => cipher.id);
  }

  describe("find_credentials without ids (the by-relying-party path)", () => {
    it("returns discoverable passkeys for the relying party", async () => {
      vaultHolds([makePasskeyCipher({ id: ID.match, discoverable: true })]);

      expect(await findIds(undefined)).toEqual([ID.match]);
    });

    it("excludes non-discoverable passkeys", async () => {
      vaultHolds([makePasskeyCipher({ id: ID.hidden, discoverable: false })]);

      expect(await findIds(undefined)).toEqual([]);
    });

    it("excludes other relying parties, deleted ciphers, non-logins, and passkey-less logins", async () => {
      vaultHolds([
        makePasskeyCipher({ id: ID.wrongRp, rpId: OTHER_RP_ID }),
        makePasskeyCipher({ id: ID.deleted, deleted: true }),
        makePasskeyCipher({ id: ID.notALogin, type: CipherType.Card }),
        makeNonPasskeyCipher(ID.noPasskey),
        makePasskeyCipher({ id: ID.keeper }),
      ]);

      expect(await findIds(undefined)).toEqual([ID.keeper]);
    });

    it("treats an empty id list as no id filter", async () => {
      vaultHolds([makePasskeyCipher({ id: ID.match, discoverable: true })]);

      expect(await findIds([])).toEqual([ID.match]);
    });
  });

  describe("find_credentials with ids (the by-id path)", () => {
    it("matches a credential id supplied as number[]", async () => {
      vaultHolds([makePasskeyCipher({ id: ID.match, credentialId: CREDENTIAL_ID })]);

      const ids = [Array.from(parseCredentialId(CREDENTIAL_ID))];

      expect(await findIds(ids)).toEqual([ID.match]);
    });

    it("excludes credentials whose id was not asked for", async () => {
      vaultHolds([makePasskeyCipher({ id: ID.other, credentialId: OTHER_CREDENTIAL_ID })]);

      const ids = [Array.from(parseCredentialId(CREDENTIAL_ID))];

      expect(await findIds(ids)).toEqual([]);
    });

    it("does not require discoverable, unlike the by-relying-party path", async () => {
      vaultHolds([makePasskeyCipher({ id: ID.match, discoverable: false })]);

      const ids = [Array.from(parseCredentialId(CREDENTIAL_ID))];

      expect(await findIds(ids)).toEqual([ID.match]);
    });

    it("skips a cipher whose stored credential id cannot be parsed", async () => {
      vaultHolds([
        makePasskeyCipher({ id: ID.other, credentialId: "not-a-credential-id" }),
        makePasskeyCipher({ id: ID.match, credentialId: CREDENTIAL_ID }),
      ]);

      const ids = [Array.from(parseCredentialId(CREDENTIAL_ID))];

      expect(await findIds(ids)).toEqual([ID.match]);
    });
  });

  describe("the first-credential-only rule", () => {
    it("ignores a matching credential that is not the first", async () => {
      const second = new Fido2CredentialView();
      second.credentialId = CREDENTIAL_ID;
      second.rpId = RP_ID;
      second.discoverable = true;

      vaultHolds([
        makePasskeyCipher({
          id: ID.secondOnly,
          rpId: OTHER_RP_ID,
          extraCredentials: [second],
        }),
      ]);

      // Faithful to Fido2AuthenticatorService, which only ever reads fido2Credentials[0].
      expect(await findIds(undefined)).toEqual([]);
    });
  });

  describe("save_credential", () => {
    it("rejects a cipher the SDK could not hand over", async () => {
      await expect(store.save_credential({ cipher: undefined } as never)).rejects.toThrow(
        /unreadable cipher/,
      );
    });

    it("stamps lastUsedDate on the saved cipher", async () => {
      // The SDK saves for two reasons, registration and a counter update after an assertion, and
      // tells them apart in neither the cipher nor the call. Stamping unconditionally is what
      // keeps a counter-bearing passkey's lastUsedDate current.
      const decrypted = makePasskeyCipher({ id: ID.match });
      decrypted.localData = { lastLaunched: 1 };
      cipherService.decrypt.mockResolvedValue(decrypted);
      const before = new Date().getTime();

      await store.save_credential({
        cipher: new Cipher(cipherData(ID.match)).toSdkCipher(),
      } as never);

      expect(cipherService.updateWithServer).toHaveBeenCalledWith(decrypted, USER_ID);
      const saved = cipherService.updateWithServer.mock.calls[0][0] as CipherView;
      expect(saved.localData?.lastUsedDate).toBeGreaterThanOrEqual(before);
      // Whatever else localData carried has to survive the stamp.
      expect(saved.localData?.lastLaunched).toBe(1);
    });
  });

  /**
   * `all_credentials` is the one method that needs a real SDK client: `CipherListView` is only
   * produced by `decrypt_list`, and clients has no `CipherView` -> `CipherListView` mapping to
   * reuse. A real {@link Rc} is used rather than a stubbed `take()` so the `using` disposal in the
   * store is exercised as written.
   */
  describe("all_credentials", () => {
    let decryptList: jest.Mock;
    let client: MockProxy<PasswordManagerClient>;
    let rc: Rc<PasswordManagerClient>;

    beforeEach(() => {
      decryptList = jest.fn().mockReturnValue([]);
      client = mock<PasswordManagerClient>();
      client.vault.mockReturnValue({
        ciphers: () => ({ decrypt_list: decryptList }),
      } as never);
      rc = new Rc(client);
      sdkService.userClient$.mockReturnValue(of(rc));
    });

    it("hands every cipher in state to decrypt_list, unfiltered", async () => {
      // The SDK does its own passkey filtering, so a non-passkey cipher must still be passed on.
      stateHolds(ID.match, ID.noPasskey);

      await store.all_credentials();

      expect(decryptList).toHaveBeenCalledTimes(1);
      expect(decryptList.mock.calls[0][0].map((cipher: { id: string }) => cipher.id)).toEqual([
        ID.match,
        ID.noPasskey,
      ]);
    });

    it("returns what decrypt_list produced", async () => {
      const listView = [{ id: ID.match }] as unknown as CipherListView[];
      decryptList.mockReturnValue(listView);
      stateHolds(ID.match);

      await expect(store.all_credentials()).resolves.toBe(listView);
    });

    it("passes an empty list when state has no ciphers at all", async () => {
      cipherService.ciphers$.mockReturnValue(of(null) as never);

      await expect(store.all_credentials()).resolves.toEqual([]);
      expect(decryptList).toHaveBeenCalledWith([]);
    });

    it("throws when the SDK client is unavailable", async () => {
      stateHolds(ID.match);
      sdkService.userClient$.mockReturnValue(of(undefined) as never);

      await expect(store.all_credentials()).rejects.toThrow(/SDK client is unavailable/);
    });

    it("releases its reference, so the client can still be freed afterwards", async () => {
      stateHolds(ID.match);

      await store.all_credentials();
      expect(client.free).not.toHaveBeenCalled();

      // Only reaches zero references if the store's `using` released its own.
      rc.markForDisposal();
      expect(client.free).toHaveBeenCalledTimes(1);
    });

    it("releases its reference even when decrypt_list throws", async () => {
      stateHolds(ID.match);
      decryptList.mockImplementation(() => {
        throw new Error("decrypt failed");
      });

      await expect(store.all_credentials()).rejects.toThrow(/decrypt failed/);

      rc.markForDisposal();
      expect(client.free).toHaveBeenCalledTimes(1);
    });
  });
});
