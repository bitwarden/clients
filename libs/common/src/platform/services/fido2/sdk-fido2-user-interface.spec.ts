import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  CipherRepromptType as SdkCipherRepromptType,
  CipherView as SdkCipherView,
} from "@bitwarden/sdk-internal";

import { mockAccountServiceWith } from "../../../../spec";
import { AccountService } from "../../../auth/abstractions/account.service";
import { CipherId, UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { CipherType } from "../../../vault/enums";
import { CipherData } from "../../../vault/models/data/cipher.data";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { LoginView } from "../../../vault/models/view/login.view";
import { Fido2UserInterfaceSession } from "../../abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "../../abstractions/log.service";

import { SdkFido2UserInterface } from "./sdk-fido2-user-interface";

const USER_ID = "00000000-0000-0000-0000-000000000000" as UserId;
const CIPHER_ID = "00000000-0000-4000-8000-000000000001" as CipherId;
const OTHER_CIPHER_ID = "00000000-0000-4000-8000-000000000002" as CipherId;
const RP_ID = "bitwarden.com";

/** base64url of [1, 2, 3, 4], the encoding the session expects for a user handle. */
const USER_HANDLE_B64URL = "AQIDBA";

const REQUIRED = { requirePresence: true, requireVerification: "required" } as const;
const DISCOURAGED = { requirePresence: true, requireVerification: "discouraged" } as const;

function sdkCipherView(id: CipherId): SdkCipherView {
  return repromptCipher(id, SdkCipherRepromptType.None);
}

/** `reprompt` is not optional on `SdkCipherView`, so every fixture supplies it. */
function repromptCipher(id: CipherId, reprompt: SdkCipherRepromptType): SdkCipherView {
  return { id, name: "a passkey", reprompt } as unknown as SdkCipherView;
}

describe("SdkFido2UserInterface", () => {
  let session: MockProxy<Fido2UserInterfaceSession>;
  let cipherService: MockProxy<CipherService>;
  let accountService: AccountService;
  let logService: MockProxy<LogService>;
  let ui: SdkFido2UserInterface;

  beforeEach(() => {
    session = mock<Fido2UserInterfaceSession>();
    cipherService = mock<CipherService>();
    accountService = mockAccountServiceWith(USER_ID);
    logService = mock<LogService>();
    ui = SdkFido2UserInterface.create(session, cipherService, accountService, logService);
  });

  describe("is_verification_enabled", () => {
    it("is a property, not a method, because the SDK reads it once at construction", () => {
      expect(typeof ui.is_verification_enabled).toBe("boolean");
    });

    it("reports true, so UV::Preferred stays required as it is today", () => {
      expect(ui.is_verification_enabled).toBe(true);
    });
  });

  describe("check_user", () => {
    it("informs the user when no credentials were found, and declines", async () => {
      // The unit variant crosses the boundary as a bare string.
      const result = await ui.check_user(DISCOURAGED, "informNoCredentialsFound");

      expect(session.informCredentialNotFound).toHaveBeenCalled();
      expect(result).toEqual({ userPresent: false, userVerified: false });
    });

    it("informs the user of an excluded credential, and declines", async () => {
      const result = await ui.check_user(DISCOURAGED, {
        informExcludedCredentialFound: sdkCipherView(CIPHER_ID),
      });

      expect(session.informExcludedCredential).toHaveBeenCalledWith([CIPHER_ID]);
      expect(result).toEqual({ userPresent: false, userVerified: false });
    });

    it("asks for a new credential using the base64url user handle, not the display name", async () => {
      session.confirmNewCredential.mockResolvedValue({
        cipherId: CIPHER_ID,
        userVerified: true,
      });

      const result = await ui.check_user(REQUIRED, {
        requestNewCredential: {
          user: { id: [1, 2, 3, 4], name: "user@bitwarden.com", displayName: "Test User" },
          rp: { id: RP_ID, name: "Bitwarden" },
        },
      });

      expect(session.confirmNewCredential).toHaveBeenCalledWith({
        credentialName: "Bitwarden",
        userName: "user@bitwarden.com",
        userHandle: USER_HANDLE_B64URL,
        userVerification: true,
        rpId: RP_ID,
      });
      expect(result).toEqual({ userPresent: true, userVerified: true });
    });

    it("falls back to the relying party id when it has no name", async () => {
      session.confirmNewCredential.mockResolvedValue({ cipherId: CIPHER_ID, userVerified: false });

      await ui.check_user(DISCOURAGED, {
        requestNewCredential: {
          user: { id: [1, 2, 3, 4], name: "user", displayName: "User" },
          rp: { id: RP_ID, name: undefined },
        },
      });

      expect(session.confirmNewCredential).toHaveBeenCalledWith(
        expect.objectContaining({ credentialName: RP_ID, userVerification: false }),
      );
    });

    it("reports no presence when the user declines a new credential", async () => {
      session.confirmNewCredential.mockResolvedValue({
        cipherId: undefined,
        userVerified: false,
      });

      const result = await ui.check_user(DISCOURAGED, {
        requestNewCredential: {
          user: { id: [1, 2, 3, 4], name: "user", displayName: "User" },
          rp: { id: RP_ID, name: "Bitwarden" },
        },
      });

      expect(result).toEqual({ userPresent: false, userVerified: false });
    });

    it("asks the user to confirm an existing credential", async () => {
      session.pickCredential.mockResolvedValue({ cipherId: CIPHER_ID, userVerified: true });

      const result = await ui.check_user(REQUIRED, {
        requestExistingCredential: sdkCipherView(CIPHER_ID),
      });

      expect(session.pickCredential).toHaveBeenCalledWith({
        cipherIds: [CIPHER_ID],
        userVerification: true,
        assumeUserPresence: false,
        masterPasswordRepromptRequired: false,
      });
      expect(result).toEqual({ userPresent: true, userVerified: true });
    });
  });

  describe("pick_credential_for_authentication", () => {
    it("returns the cipher the user picked, from the list the SDK supplied", async () => {
      session.pickCredential.mockResolvedValue({ cipherId: OTHER_CIPHER_ID, userVerified: true });
      const available = [sdkCipherView(CIPHER_ID), sdkCipherView(OTHER_CIPHER_ID)];

      const picked = await ui.pick_credential_for_authentication(available);

      expect(picked).toBe(available[1]);
      expect(session.pickCredential).toHaveBeenCalledWith({
        cipherIds: [CIPHER_ID, OTHER_CIPHER_ID],
        userVerification: false,
        assumeUserPresence: false,
        masterPasswordRepromptRequired: false,
      });
    });

    it("throws when the pick does not match anything offered", async () => {
      session.pickCredential.mockResolvedValue({ cipherId: OTHER_CIPHER_ID, userVerified: true });

      await expect(
        ui.pick_credential_for_authentication([sdkCipherView(CIPHER_ID)]),
      ).rejects.toThrow(/could not be found/);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("assumeUserPresence", () => {
    /**
     * The flag has no CTAP request field, so it is carried on the adapter instead. Both
     * `pickCredential` call sites need it: the browser session's silent shortcut is
     * `assumeUserPresence && cipherIds.length === 1 && !masterPasswordRepromptRequired`, so
     * dropping it on either one turns the mediated conditional path back into a second prompt.
     */
    function uiAssuming(present: boolean): SdkFido2UserInterface {
      return SdkFido2UserInterface.create(
        session,
        cipherService,
        accountService,
        logService,
        present,
      );
    }

    beforeEach(() => {
      session.pickCredential.mockResolvedValue({ cipherId: CIPHER_ID, userVerified: true });
    });

    it("reaches pickCredential from pick_credential_for_authentication", async () => {
      await uiAssuming(true).pick_credential_for_authentication([sdkCipherView(CIPHER_ID)]);

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ assumeUserPresence: true }),
      );
    });

    it("reaches pickCredential from the requestExistingCredential hint", async () => {
      await uiAssuming(true).check_user(REQUIRED, {
        requestExistingCredential: sdkCipherView(CIPHER_ID),
      });

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ assumeUserPresence: true }),
      );
    });

    it("defaults to false, which is what every non-mediated ceremony wants", async () => {
      await uiAssuming(false).pick_credential_for_authentication([sdkCipherView(CIPHER_ID)]);

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ assumeUserPresence: false }),
      );
    });
  });

  describe("check_user_and_pick_credential_for_creation", () => {
    const newCredential = {
      credentialId: "ignored",
      keyType: "public-key",
      keyAlgorithm: "ECDSA",
      keyCurve: "P-256",
      rpId: RP_ID,
      rpName: "Bitwarden",
      userHandle: USER_HANDLE_B64URL,
      userName: "user@bitwarden.com",
      userDisplayName: "Test User",
      counter: "0",
    } as never;

    it("resolves the chosen cipher out of local state", async () => {
      session.confirmNewCredential.mockResolvedValue({ cipherId: CIPHER_ID, userVerified: true });
      cipherService.ciphers$.mockReturnValue(
        of({ [CIPHER_ID]: { id: CIPHER_ID } as unknown as CipherData } as Record<
          CipherId,
          CipherData
        >),
      );
      const decrypted = new CipherView();
      decrypted.id = CIPHER_ID;
      decrypted.type = CipherType.Login;
      decrypted.login = new LoginView();
      cipherService.decrypt.mockResolvedValue(decrypted);

      const result = await ui.check_user_and_pick_credential_for_creation(REQUIRED, newCredential);

      expect(result.cipher.id).toBe(CIPHER_ID);
      expect(result.checkUserResult).toEqual({ userPresent: true, userVerified: true });
    });

    it("passes the SDK's user handle through unchanged", async () => {
      session.confirmNewCredential.mockResolvedValue({ cipherId: undefined, userVerified: false });

      await expect(
        ui.check_user_and_pick_credential_for_creation(REQUIRED, newCredential),
      ).rejects.toThrow(/confirmation was not received/);

      expect(session.confirmNewCredential).toHaveBeenCalledWith(
        expect.objectContaining({ userHandle: USER_HANDLE_B64URL, credentialName: "Bitwarden" }),
      );
    });
  });

  describe("ceremony isolation", () => {
    it("keeps concurrent ceremonies on their own sessions", async () => {
      const otherSession = mock<Fido2UserInterfaceSession>();
      SdkFido2UserInterface.create(otherSession, cipherService, accountService, logService);

      await ui.check_user(DISCOURAGED, "informNoCredentialsFound");

      expect(session.informCredentialNotFound).toHaveBeenCalled();
      expect(otherSession.informCredentialNotFound).not.toHaveBeenCalled();
    });
  });

  /**
   * The fallback path — "use the browser instead" — does not travel through this adapter at all.
   * The session aborts the caller's `AbortController` with `UserRequestedFallbackAbortReason` on
   * its own (`browser-fido2-user-interface.service.ts:219`, `:382`; `abort` there is private and
   * has no external callers), and the layer that owns the controller reads `signal.reason` once
   * the SDK call rejects (`fido2-client.service.ts:229`, `:377`).
   *
   * So this adapter's obligation is entirely negative: let the rejection through untouched. If a
   * callback swallowed it and returned a value, the SDK would carry on, the ceremony would never
   * reject, and the reason check downstream would never run. These tests are the gate on that.
   */
  describe("abort propagation", () => {
    /**
     * Stands in for the browser's `SessionClosedError`, which lives in `apps/browser` and cannot
     * be imported here. What matters is that it is a rejection, not which class it is.
     */
    class ClosedError extends Error {}

    let closed: ClosedError;

    beforeEach(() => {
      closed = new ClosedError("session closed");
      session.informCredentialNotFound.mockRejectedValue(closed);
      session.informExcludedCredential.mockRejectedValue(closed);
      session.confirmNewCredential.mockRejectedValue(closed);
      session.pickCredential.mockRejectedValue(closed);
    });

    it("propagates a rejection from informCredentialNotFound", async () => {
      await expect(ui.check_user(DISCOURAGED, "informNoCredentialsFound")).rejects.toBe(closed);
    });

    it("propagates a rejection from informExcludedCredential", async () => {
      await expect(
        ui.check_user(DISCOURAGED, { informExcludedCredentialFound: sdkCipherView(CIPHER_ID) }),
      ).rejects.toBe(closed);
    });

    it("propagates a rejection from confirmNewCredential", async () => {
      await expect(
        ui.check_user(REQUIRED, {
          requestNewCredential: {
            user: { id: [1, 2, 3, 4], name: "user@bitwarden.com", displayName: "Test User" },
            rp: { id: RP_ID, name: "Bitwarden" },
          },
        }),
      ).rejects.toBe(closed);
    });

    it("propagates a rejection from pickCredential", async () => {
      await expect(
        ui.check_user(REQUIRED, { requestExistingCredential: sdkCipherView(CIPHER_ID) }),
      ).rejects.toBe(closed);
    });

    it("propagates a rejection out of pick_credential_for_authentication", async () => {
      await expect(ui.pick_credential_for_authentication([sdkCipherView(CIPHER_ID)])).rejects.toBe(
        closed,
      );
    });

    it("propagates a rejection out of check_user_and_pick_credential_for_creation", async () => {
      const newCredential = {
        rpId: RP_ID,
        rpName: "Bitwarden",
        userHandle: USER_HANDLE_B64URL,
        userName: "user@bitwarden.com",
      } as never;

      await expect(
        ui.check_user_and_pick_credential_for_creation(REQUIRED, newCredential),
      ).rejects.toBe(closed);
    });

    it("leaves the session open, because closing it belongs to the layer that opened it", async () => {
      await expect(ui.check_user(DISCOURAGED, "informNoCredentialsFound")).rejects.toBe(closed);

      expect(session.close).not.toHaveBeenCalled();
    });

    it("owns no AbortController, so it cannot replace the caller's", () => {
      const owned = Object.values(ui).filter((value) => value instanceof AbortController);

      expect(owned).toEqual([]);
    });
  });

  /**
   * The flag exists to stop a session silently handing back a reprompt-protected credential.
   * Desktop's shortcut does not also require `assumeUserPresence`
   * (`desktop-fido2-user-interface.service.ts:298-299`), so a missing flag is a reprompt bypass,
   * not just a missing prompt.
   */
  describe("masterPasswordRepromptRequired", () => {
    beforeEach(() => {
      session.pickCredential.mockResolvedValue({ cipherId: CIPHER_ID, userVerified: true });
    });

    it("is false when no candidate requires a reprompt", async () => {
      await ui.pick_credential_for_authentication([
        repromptCipher(CIPHER_ID, SdkCipherRepromptType.None),
      ]);

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ masterPasswordRepromptRequired: false }),
      );
    });

    it("is true when a candidate requires a reprompt", async () => {
      await ui.pick_credential_for_authentication([
        repromptCipher(CIPHER_ID, SdkCipherRepromptType.Password),
      ]);

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ masterPasswordRepromptRequired: true }),
      );
    });

    it("is true if any candidate requires one, matching the authenticator's `some`", async () => {
      await ui.pick_credential_for_authentication([
        repromptCipher(CIPHER_ID, SdkCipherRepromptType.None),
        repromptCipher(OTHER_CIPHER_ID, SdkCipherRepromptType.Password),
      ]);

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ masterPasswordRepromptRequired: true }),
      );
    });

    it("is passed for a requestExistingCredential hint too", async () => {
      await ui.check_user(REQUIRED, {
        requestExistingCredential: repromptCipher(CIPHER_ID, SdkCipherRepromptType.Password),
      });

      expect(session.pickCredential).toHaveBeenCalledWith(
        expect.objectContaining({ masterPasswordRepromptRequired: true }),
      );
    });

    it("is never left undefined, which desktop would read as 'no reprompt needed'", async () => {
      await ui.pick_credential_for_authentication([
        repromptCipher(CIPHER_ID, SdkCipherRepromptType.Password),
      ]);

      const params = session.pickCredential.mock.calls[0][0];
      expect(params.masterPasswordRepromptRequired).not.toBeUndefined();
    });
  });
});
