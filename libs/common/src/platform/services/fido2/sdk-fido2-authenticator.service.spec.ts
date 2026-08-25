import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  Fido2CredentialAutofillView,
  GetAssertionResult,
  MakeCredentialResult,
  PasswordManagerClient,
  CipherView as SdkCipherView,
} from "@bitwarden/sdk-internal";

import { mockAccountServiceWith } from "../../../../spec";
import { AccountService } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "../../../vault/enums";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { LoginView } from "../../../vault/models/view/login.view";
import { ConfigService } from "../../abstractions/config/config.service";
import {
  Fido2AuthenticatorError,
  Fido2AuthenticatorGetAssertionParams,
  Fido2AuthenticatorMakeCredentialsParams,
  Fido2AuthenticatorService,
} from "../../abstractions/fido2/fido2-authenticator.service.abstraction";
import {
  Fido2UserInterfaceService,
  Fido2UserInterfaceSession,
} from "../../abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "../../abstractions/log.service";
import { SdkLoadService } from "../../abstractions/sdk/sdk-load.service";
import { SdkService } from "../../abstractions/sdk/sdk.service";
import { Rc } from "../../misc/reference-counting/rc";

import { parseCredentialId } from "./credential-id-utils";
import {
  RefusingFido2UserInterface,
  SdkFido2AuthenticatorService,
} from "./sdk-fido2-authenticator.service";
import { SdkFido2CredentialStore } from "./sdk-fido2-credential-store";

const USER_ID = "00000000-0000-0000-0000-000000000000" as UserId;
const RP_ID = "bitwarden.com";
const CIPHER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_CIPHER_ID = "00000000-0000-4000-8000-000000000002";
const CREDENTIAL_ID = "d548e0e0-4b8e-4f0e-9e26-1c4d5f6a7b8c";
const SECOND_CREDENTIAL_ID = "a1b2c3d4-1111-2222-3333-444455556666";

function credentialView(credentialId: string): Fido2CredentialView {
  const credential = new Fido2CredentialView();
  credential.credentialId = credentialId;
  credential.rpId = RP_ID;
  credential.discoverable = true;
  return credential;
}

function passkeyCipher(id: string, ...credentialIds: string[]): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.type = CipherType.Login;
  cipher.login = new LoginView();
  cipher.login.fido2Credentials = credentialIds.map(credentialView);
  return cipher;
}

const CLIENT_DATA_HASH = new Uint8Array([10, 20, 30, 40]);
const USER_HANDLE = new Uint8Array([1, 2, 3, 4]);

/** Distinct byte values per field, so a mis-wired mapping shows up as the wrong bytes. */
const SDK_MAKE_CREDENTIAL_RESULT = {
  credentialId: [1, 1],
  attestationObject: [2, 2],
  authenticatorData: [3, 3],
  publicKey: [4, 4],
  publicKeyAlgorithm: -7,
  extensions: {},
} as unknown as MakeCredentialResult;

const SDK_GET_ASSERTION_RESULT = {
  credentialId: [1, 1],
  authenticatorData: [3, 3],
  signature: [5, 5],
  userHandle: [1, 2, 3, 4],
  selectedCredential: {},
  extensions: {},
} as unknown as GetAssertionResult;

function makeCredentialParams(
  overrides: Partial<Fido2AuthenticatorMakeCredentialsParams> = {},
): Fido2AuthenticatorMakeCredentialsParams {
  return {
    hash: CLIENT_DATA_HASH,
    rpEntity: { id: RP_ID, name: "Bitwarden" },
    userEntity: { id: USER_HANDLE, name: "user@example.com", displayName: "A User" },
    credTypesAndPubKeyAlgs: [{ alg: -7, type: "public-key" }],
    requireResidentKey: true,
    requireUserVerification: true,
    fallbackSupported: true,
    ...overrides,
  };
}

function getAssertionParams(
  overrides: Partial<Fido2AuthenticatorGetAssertionParams> = {},
): Fido2AuthenticatorGetAssertionParams {
  return {
    rpId: RP_ID,
    hash: CLIENT_DATA_HASH,
    requireUserVerification: false,
    extensions: {},
    fallbackSupported: true,
    ...overrides,
  };
}

/** A cipher carrying one passkey with the given counter, as the sync heuristic reads it. */
function cipherWithCounter(counter: number): CipherView {
  const cipher = passkeyCipher(CIPHER_ID, CREDENTIAL_ID);
  cipher.login.fido2Credentials[0].counter = counter;
  return cipher;
}

/** What the SDK hands back: raw credential id bytes and a branded cipher id. */
function discovered(cipherId: string, credentialId: string): Fido2CredentialAutofillView {
  return {
    credentialId: Array.from(parseCredentialId(credentialId)),
    cipherId,
    rpId: RP_ID,
    userNameForUi: "user@example.com",
    userHandle: [1, 2, 3, 4],
    hasCounter: false,
  } as unknown as Fido2CredentialAutofillView;
}

describe("SdkFido2AuthenticatorService", () => {
  let fallback: MockProxy<Fido2AuthenticatorService<unknown>>;
  let credentialStore: MockProxy<SdkFido2CredentialStore>;
  let cipherService: MockProxy<CipherService>;
  let userInterfaceService: MockProxy<Fido2UserInterfaceService<unknown>>;
  let session: MockProxy<Fido2UserInterfaceSession>;
  let syncService: MockProxy<SyncService>;
  let accountService: AccountService;
  let sdkService: MockProxy<SdkService>;
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;

  let client: MockProxy<PasswordManagerClient>;
  let rc: Rc<PasswordManagerClient>;
  let silentlyDiscover: jest.Mock;
  let makeCredential: jest.Mock;
  let getAssertion: jest.Mock;
  let disposeAuthenticator: jest.Mock;
  let buildAuthenticator: jest.Mock;

  beforeEach(() => {
    // The service awaits SdkLoadService.Ready, which never resolves under test.
    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });

    fallback = mock<Fido2AuthenticatorService<unknown>>();
    credentialStore = mock<SdkFido2CredentialStore>();
    cipherService = mock<CipherService>();
    userInterfaceService = mock<Fido2UserInterfaceService<unknown>>();
    session = mock<Fido2UserInterfaceSession>();
    userInterfaceService.newSession.mockResolvedValue(session);
    syncService = mock<SyncService>();
    // Synced just now, so the default is "no sync needed" and each sync test opts in.
    syncService.activeUserLastSync$.mockReturnValue(of(new Date()));
    credentialStore.findCredentialCiphers.mockResolvedValue([cipherWithCounter(0)]);
    accountService = mockAccountServiceWith(USER_ID);
    sdkService = mock<SdkService>();
    configService = mock<ConfigService>();
    logService = mock<LogService>();

    silentlyDiscover = jest.fn().mockResolvedValue([]);
    makeCredential = jest.fn().mockResolvedValue(SDK_MAKE_CREDENTIAL_RESULT);
    getAssertion = jest.fn().mockResolvedValue(SDK_GET_ASSERTION_RESULT);
    disposeAuthenticator = jest.fn();
    buildAuthenticator = jest.fn().mockReturnValue({
      silently_discover_credentials: silentlyDiscover,
      make_credential: makeCredential,
      get_assertion: getAssertion,
      [Symbol.dispose]: disposeAuthenticator,
    });

    client = mock<PasswordManagerClient>();
    client.platform.mockReturnValue({
      fido2: () => ({ authenticator: buildAuthenticator }),
    } as never);
    rc = new Rc(client);
    sdkService.userClient$.mockReturnValue(of(rc));
  });

  /** The flag is read into a field initializer, so it has to be set before construction. */
  function createService(flagEnabled: boolean) {
    configService.getFeatureFlag$.mockReturnValue(of(flagEnabled) as never);
    return new SdkFido2AuthenticatorService<unknown>(
      fallback,
      credentialStore,
      cipherService,
      userInterfaceService,
      syncService,
      accountService,
      sdkService,
      configService,
      logService,
    );
  }

  describe("with the flag off", () => {
    it("delegates silent discovery to the TypeScript authenticator", async () => {
      const expected = [credentialView(CREDENTIAL_ID)];
      fallback.silentCredentialDiscovery.mockResolvedValue(expected);

      await expect(createService(false).silentCredentialDiscovery(RP_ID)).resolves.toBe(expected);
      expect(fallback.silentCredentialDiscovery).toHaveBeenCalledWith(RP_ID);
    });

    it("does not touch the SDK at all", async () => {
      await createService(false).silentCredentialDiscovery(RP_ID);

      expect(sdkService.userClient$).not.toHaveBeenCalled();
      expect(buildAuthenticator).not.toHaveBeenCalled();
    });
  });

  describe("with the flag on", () => {
    it("asks the SDK for the relying party, with no user handle filter", async () => {
      await createService(true).silentCredentialDiscovery(RP_ID);

      expect(silentlyDiscover).toHaveBeenCalledWith(RP_ID, undefined);
      expect(fallback.silentCredentialDiscovery).not.toHaveBeenCalled();
    });

    it("builds the authenticator with the credential store and a refusing user interface", async () => {
      await createService(true).silentCredentialDiscovery(RP_ID);

      const [userInterface, store] = buildAuthenticator.mock.calls[0];
      expect(userInterface).toBeInstanceOf(RefusingFido2UserInterface);
      expect(store).toBe(credentialStore);
    });

    it("returns the vault's own view for each discovered credential", async () => {
      const cipher = passkeyCipher(CIPHER_ID, CREDENTIAL_ID);
      cipherService.getAllDecrypted.mockResolvedValue([cipher]);
      silentlyDiscover.mockResolvedValue([discovered(CIPHER_ID, CREDENTIAL_ID)]);

      const result = await createService(true).silentCredentialDiscovery(RP_ID);

      // Identity, not shape: the fully populated view has to come from the vault, because the SDK's
      // autofill view carries no keyValue, counter or creationDate to rebuild one from.
      expect(result).toEqual([cipher.login.fido2Credentials[0]]);
      expect(result[0]).toBe(cipher.login.fido2Credentials[0]);
    });

    it("returns the credential the SDK found, not fido2Credentials[0]", async () => {
      const cipher = passkeyCipher(CIPHER_ID, CREDENTIAL_ID, SECOND_CREDENTIAL_ID);
      cipherService.getAllDecrypted.mockResolvedValue([cipher]);
      silentlyDiscover.mockResolvedValue([discovered(CIPHER_ID, SECOND_CREDENTIAL_ID)]);

      const result = await createService(true).silentCredentialDiscovery(RP_ID);

      expect(result).toEqual([cipher.login.fido2Credentials[1]]);
      expect(result[0].credentialId).toBe(SECOND_CREDENTIAL_ID);
    });

    it("keeps one entry per discovered credential when a cipher holds two", async () => {
      const cipher = passkeyCipher(CIPHER_ID, CREDENTIAL_ID, SECOND_CREDENTIAL_ID);
      cipherService.getAllDecrypted.mockResolvedValue([cipher]);
      silentlyDiscover.mockResolvedValue([
        discovered(CIPHER_ID, CREDENTIAL_ID),
        discovered(CIPHER_ID, SECOND_CREDENTIAL_ID),
      ]);

      const result = await createService(true).silentCredentialDiscovery(RP_ID);

      expect(result.map((view) => view.credentialId)).toEqual([
        CREDENTIAL_ID,
        SECOND_CREDENTIAL_ID,
      ]);
    });

    it("discards a credential whose cipher is no longer in the vault, and says so", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([
        passkeyCipher(OTHER_CIPHER_ID, CREDENTIAL_ID),
      ]);
      silentlyDiscover.mockResolvedValue([discovered(CIPHER_ID, CREDENTIAL_ID)]);

      await expect(createService(true).silentCredentialDiscovery(RP_ID)).resolves.toEqual([]);
      expect(logService.warning).toHaveBeenCalledTimes(1);
    });

    it("discards a credential whose id is no longer on the cipher", async () => {
      cipherService.getAllDecrypted.mockResolvedValue([
        passkeyCipher(CIPHER_ID, SECOND_CREDENTIAL_ID),
      ]);
      silentlyDiscover.mockResolvedValue([discovered(CIPHER_ID, CREDENTIAL_ID)]);

      await expect(createService(true).silentCredentialDiscovery(RP_ID)).resolves.toEqual([]);
      expect(logService.warning).toHaveBeenCalledTimes(1);
    });

    it("does not decrypt the vault when nothing was discovered", async () => {
      silentlyDiscover.mockResolvedValue([]);

      await expect(createService(true).silentCredentialDiscovery(RP_ID)).resolves.toEqual([]);
      expect(cipherService.getAllDecrypted).not.toHaveBeenCalled();
    });

    it("disposes the authenticator, which owns the callback objects", async () => {
      await createService(true).silentCredentialDiscovery(RP_ID);

      expect(disposeAuthenticator).toHaveBeenCalledTimes(1);
    });

    it("releases its SDK reference, so the client can still be freed afterwards", async () => {
      await createService(true).silentCredentialDiscovery(RP_ID);
      expect(client.free).not.toHaveBeenCalled();

      // Only reaches zero references if the service's `using` released its own.
      rc.markForDisposal();
      expect(client.free).toHaveBeenCalledTimes(1);
    });

    it("throws when the SDK client is unavailable", async () => {
      sdkService.userClient$.mockReturnValue(of(undefined) as never);

      await expect(createService(true).silentCredentialDiscovery(RP_ID)).rejects.toThrow(
        /SDK client is unavailable/,
      );
    });

    it("propagates an SDK failure instead of quietly falling back to TypeScript", async () => {
      silentlyDiscover.mockRejectedValue(new Error("discovery exploded"));

      await expect(createService(true).silentCredentialDiscovery(RP_ID)).rejects.toThrow(
        /discovery exploded/,
      );
      // A fallback here would render as "this site has no passkeys" and hide the breakage.
      expect(fallback.silentCredentialDiscovery).not.toHaveBeenCalled();
    });

    it("releases its reference even when discovery throws", async () => {
      silentlyDiscover.mockRejectedValue(new Error("discovery exploded"));

      await expect(createService(true).silentCredentialDiscovery(RP_ID)).rejects.toThrow();

      rc.markForDisposal();
      expect(client.free).toHaveBeenCalledTimes(1);
    });
  });

  describe("makeCredential with the flag off", () => {
    const window = {};

    it("delegates to the TypeScript authenticator", async () => {
      const params = makeCredentialParams();
      const abortController = new AbortController();

      await createService(false).makeCredential(params, window, abortController);

      expect(fallback.makeCredential).toHaveBeenCalledWith(params, window, abortController);
    });

    it("opens no session and touches no SDK", async () => {
      await createService(false).makeCredential(makeCredentialParams(), window);

      expect(userInterfaceService.newSession).not.toHaveBeenCalled();
      expect(buildAuthenticator).not.toHaveBeenCalled();
      expect(syncService.fullSync).not.toHaveBeenCalled();
    });
  });

  describe("makeCredential with the flag on", () => {
    const window = {};

    it("maps the request onto the SDK's CTAP shape", async () => {
      await createService(true).makeCredential(
        makeCredentialParams({
          excludeCredentialDescriptorList: [
            { id: new Uint8Array([7, 7]), type: "public-key", transports: ["internal"] },
          ],
        }),
        window,
      );

      expect(makeCredential).toHaveBeenCalledWith({
        clientDataHash: [10, 20, 30, 40],
        rp: { id: RP_ID, name: "Bitwarden" },
        user: { id: [1, 2, 3, 4], name: "user@example.com", displayName: "A User" },
        pubKeyCredParams: [{ ty: "public-key", alg: -7 }],
        excludeList: [{ ty: "public-key", id: [7, 7], transports: ["internal"] }],
        options: { rk: true, uv: "required" },
        extensions: undefined,
      });
    });

    it("sends no exclude list when the relying party supplied none", async () => {
      await createService(true).makeCredential(makeCredentialParams(), window);

      expect(makeCredential.mock.calls[0][0].excludeList).toBeUndefined();
    });

    it("maps a false verification requirement to discouraged, not preferred", async () => {
      await createService(true).makeCredential(
        makeCredentialParams({ requireUserVerification: false }),
        window,
      );

      expect(makeCredential.mock.calls[0][0].options.uv).toBe("discouraged");
    });

    it("substitutes empty strings for the user fields the SDK requires", async () => {
      await createService(true).makeCredential(
        makeCredentialParams({ userEntity: { id: USER_HANDLE } }),
        window,
      );

      expect(makeCredential.mock.calls[0][0].user).toEqual({
        id: [1, 2, 3, 4],
        name: "",
        displayName: "",
      });
    });

    it("maps the result back onto the abstraction, as byte arrays", async () => {
      const result = await createService(true).makeCredential(makeCredentialParams(), window);

      expect(result).toEqual({
        credentialId: new Uint8Array([1, 1]),
        attestationObject: new Uint8Array([2, 2]),
        authData: new Uint8Array([3, 3]),
        publicKey: new Uint8Array([4, 4]),
        publicKeyAlgorithm: -7,
      });
    });

    it("opens the session with the caller's window and abort controller", async () => {
      const abortController = new AbortController();

      await createService(true).makeCredential(
        makeCredentialParams({ fallbackSupported: false }),
        window,
        abortController,
      );

      // The controller has to be forwarded, not replaced: the fallback sentinel is read off it.
      expect(userInterfaceService.newSession).toHaveBeenCalledWith(false, window, abortController);
    });

    it("unlocks the vault before running the ceremony", async () => {
      session.ensureUnlockedVault.mockRejectedValue(new Error("still locked"));

      await expect(
        createService(true).makeCredential(makeCredentialParams(), window),
      ).rejects.toThrow(/still locked/);
      expect(makeCredential).not.toHaveBeenCalled();
    });

    it("throws rather than guessing when the relying party id is missing", async () => {
      await expect(
        createService(true).makeCredential(
          makeCredentialParams({ rpEntity: { name: "Bitwarden" } }),
          window,
        ),
      ).rejects.toThrow(Fido2AuthenticatorError);
      expect(session.close).toHaveBeenCalledTimes(1);
    });

    it("closes the session once the ceremony succeeds", async () => {
      await createService(true).makeCredential(makeCredentialParams(), window);

      expect(session.close).toHaveBeenCalledTimes(1);
    });

    it("closes the session when the ceremony fails", async () => {
      makeCredential.mockRejectedValue(new Error("creation exploded"));

      await expect(
        createService(true).makeCredential(makeCredentialParams(), window),
      ).rejects.toThrow(/creation exploded/);
      expect(session.close).toHaveBeenCalledTimes(1);
    });

    it("propagates a failure instead of retrying through TypeScript", async () => {
      makeCredential.mockRejectedValue(new Error("creation exploded"));

      await expect(
        createService(true).makeCredential(makeCredentialParams(), window),
      ).rejects.toThrow(/creation exploded/);
      // Retrying would prompt the user to approve the same ceremony a second time.
      expect(fallback.makeCredential).not.toHaveBeenCalled();
    });

    it("builds the authenticator with a prompting user interface and the credential store", async () => {
      await createService(true).makeCredential(makeCredentialParams(), window);

      const [userInterface, store] = buildAuthenticator.mock.calls[0];
      expect(userInterface).not.toBeInstanceOf(RefusingFido2UserInterface);
      expect(store).toBe(credentialStore);
    });

    describe("the sync that keeps the exclude list trustworthy", () => {
      it("syncs when the vault has not been synced within the threshold", async () => {
        const hoursAgo = new Date(Date.now() - 1000 * 60 * 60);
        syncService.activeUserLastSync$.mockReturnValue(of(hoursAgo));

        await createService(true).makeCredential(makeCredentialParams(), window);

        expect(syncService.fullSync).toHaveBeenCalledWith(false);
      });

      it("syncs when the vault has never been synced", async () => {
        syncService.activeUserLastSync$.mockReturnValue(of(null));

        await createService(true).makeCredential(makeCredentialParams(), window);

        expect(syncService.fullSync).toHaveBeenCalledWith(false);
      });

      it("does not sync when the vault was synced recently", async () => {
        const minutesAgo = new Date(Date.now() - 1000 * 60 * 5);
        syncService.activeUserLastSync$.mockReturnValue(of(minutesAgo));

        await createService(true).makeCredential(makeCredentialParams(), window);

        expect(syncService.fullSync).not.toHaveBeenCalled();
      });
    });
  });

  describe("getAssertion with the flag off", () => {
    const window = {};

    it("delegates to the TypeScript authenticator", async () => {
      const params = getAssertionParams();
      const abortController = new AbortController();

      await createService(false).getAssertion(params, window, abortController);

      expect(fallback.getAssertion).toHaveBeenCalledWith(params, window, abortController);
    });

    it("opens no session and touches no SDK", async () => {
      await createService(false).getAssertion(getAssertionParams(), window);

      expect(userInterfaceService.newSession).not.toHaveBeenCalled();
      expect(buildAuthenticator).not.toHaveBeenCalled();
      expect(syncService.fullSync).not.toHaveBeenCalled();
    });
  });

  describe("getAssertion with the flag on", () => {
    const window = {};

    it("maps the request onto the SDK's CTAP shape", async () => {
      await createService(true).getAssertion(
        getAssertionParams({
          requireUserVerification: true,
          allowCredentialDescriptorList: [
            { id: new Uint8Array([7, 7]), type: "public-key", transports: undefined },
          ],
        }),
        window,
      );

      expect(getAssertion).toHaveBeenCalledWith({
        rpId: RP_ID,
        clientDataHash: [10, 20, 30, 40],
        allowList: [{ ty: "public-key", id: [7, 7], transports: undefined }],
        // `rk` is meaningless for CTAP get_assertion, so it stays false rather than guessing.
        options: { rk: false, uv: "required" },
        extensions: undefined,
      });
    });

    it("sends no allow list when the relying party supplied none", async () => {
      await createService(true).getAssertion(getAssertionParams(), window);

      expect(getAssertion.mock.calls[0][0].allowList).toBeUndefined();
    });

    it("maps the result back onto the abstraction, as byte arrays", async () => {
      const result = await createService(true).getAssertion(getAssertionParams(), window);

      expect(result).toEqual({
        selectedCredential: {
          id: new Uint8Array([1, 1]),
          userHandle: new Uint8Array([1, 2, 3, 4]),
        },
        authenticatorData: new Uint8Array([3, 3]),
        signature: new Uint8Array([5, 5]),
      });
    });

    it("unlocks the vault before running the ceremony", async () => {
      session.ensureUnlockedVault.mockRejectedValue(new Error("still locked"));

      await expect(createService(true).getAssertion(getAssertionParams(), window)).rejects.toThrow(
        /still locked/,
      );
      expect(getAssertion).not.toHaveBeenCalled();
    });

    it("closes the session once the ceremony succeeds", async () => {
      await createService(true).getAssertion(getAssertionParams(), window);

      expect(session.close).toHaveBeenCalledTimes(1);
    });

    it("closes the session when the ceremony fails", async () => {
      getAssertion.mockRejectedValue(new Error("assertion exploded"));

      await expect(createService(true).getAssertion(getAssertionParams(), window)).rejects.toThrow(
        /assertion exploded/,
      );
      expect(session.close).toHaveBeenCalledTimes(1);
    });

    it("propagates a failure instead of retrying through TypeScript", async () => {
      getAssertion.mockRejectedValue(new Error("assertion exploded"));

      await expect(createService(true).getAssertion(getAssertionParams(), window)).rejects.toThrow(
        /assertion exploded/,
      );
      expect(fallback.getAssertion).not.toHaveBeenCalled();
    });

    it("forwards assumeUserPresence to the session, so the inline menu does not prompt twice", async () => {
      const cipher = { id: CIPHER_ID, reprompt: 0 } as unknown as SdkCipherView;
      session.pickCredential.mockResolvedValue({ cipherId: CIPHER_ID, userVerified: true });

      await createService(true).getAssertion(
        getAssertionParams({ assumeUserPresence: true }),
        window,
      );

      // The flag has no CTAP request field; it only reaches the session through the adapter the
      // ceremony was built with.
      const [userInterface] = buildAuthenticator.mock.calls[0];
      await userInterface.pick_credential_for_authentication([cipher]);

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ assumeUserPresence: true }),
      );
    });

    it("defaults assumeUserPresence to false when the request omits it", async () => {
      const cipher = { id: CIPHER_ID, reprompt: 0 } as unknown as SdkCipherView;
      session.pickCredential.mockResolvedValue({ cipherId: CIPHER_ID, userVerified: true });

      await createService(true).getAssertion(getAssertionParams(), window);

      const [userInterface] = buildAuthenticator.mock.calls[0];
      await userInterface.pick_credential_for_authentication([cipher]);

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ assumeUserPresence: false }),
      );
    });

    describe("the sync that catches a credential used elsewhere", () => {
      it("does not sync when the credential is here and has never been used", async () => {
        credentialStore.findCredentialCiphers.mockResolvedValue([cipherWithCounter(0)]);

        await createService(true).getAssertion(getAssertionParams(), window);

        expect(syncService.fullSync).not.toHaveBeenCalled();
      });

      it("syncs when no matching credential is here yet", async () => {
        credentialStore.findCredentialCiphers.mockResolvedValue([]);

        await createService(true).getAssertion(getAssertionParams(), window);

        expect(syncService.fullSync).toHaveBeenCalledWith(false);
      });

      it("syncs when a matching credential has been asserted before", async () => {
        credentialStore.findCredentialCiphers.mockResolvedValue([cipherWithCounter(3)]);

        await createService(true).getAssertion(getAssertionParams(), window);

        expect(syncService.fullSync).toHaveBeenCalledWith(false);
      });

      it("looks the credential up by the allow list when the relying party sent one", async () => {
        const id = new Uint8Array([7, 7]);

        await createService(true).getAssertion(
          getAssertionParams({
            allowCredentialDescriptorList: [{ id, type: "public-key" }],
          }),
          window,
        );

        expect(credentialStore.findCredentialCiphers).toHaveBeenCalledWith([id], RP_ID);
      });

      it("asks for discoverable credentials when the relying party sent no allow list", async () => {
        await createService(true).getAssertion(getAssertionParams(), window);

        expect(credentialStore.findCredentialCiphers).toHaveBeenCalledWith(undefined, RP_ID);
      });
    });
  });
});

describe("RefusingFido2UserInterface", () => {
  const userInterface = new RefusingFido2UserInterface();

  it("reports verification as enabled, matching the prompting adapter", () => {
    expect(userInterface.is_verification_enabled).toBe(true);
  });

  it.each([
    ["check_user", () => userInterface.check_user()],
    [
      "pick_credential_for_authentication",
      () => userInterface.pick_credential_for_authentication(),
    ],
    [
      "check_user_and_pick_credential_for_creation",
      () => userInterface.check_user_and_pick_credential_for_creation(),
    ],
  ])("rejects %s rather than reporting a decline", async (name, call) => {
    await expect(call()).rejects.toThrow(new RegExp(`${name} was called`));
  });
});
