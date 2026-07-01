// eslint-disable-next-line no-restricted-imports
import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { PasskeyRelayService, PasskeyUnlockRelayResult } from "./passkey-relay.service";
import { UnlockWithPasskeyResultService } from "./unlock-with-passkey-result.service";

describe("UnlockWithPasskeyResultService", () => {
  let service: UnlockWithPasskeyResultService;
  let passkeyRelayService: PasskeyRelayService;
  let webAuthnLoginPrfKeyService: WebAuthnLoginPrfKeyServiceAbstraction;
  let userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction;
  let accountService: AccountService;
  let encryptService: EncryptService;
  let keyService: KeyService;
  let i18nService: I18nService;
  let logService: LogService;

  const testUserId = "00000000-0000-0000-0000-000000000002" as UserId;
  const credentialId = "credential-id";
  const encryptedPrivateKey = "encrypted-private-key";
  const encryptedUserKey = "encrypted-user-key";

  const activeAccount$ = new BehaviorSubject<{ id: string | null; name: string }>({
    id: testUserId,
    name: "Test Account",
  });

  const decryptionOptions = {
    webAuthnPrfOptions: [
      {
        credentialId,
        encryptedPrivateKey,
        encryptedUserKey,
        transports: ["usb"],
      },
    ],
  };

  const prfKey = mock<UserKey>();
  const privateKey = new Uint8Array([9, 8, 7]);
  const userKey = mock<UserKey>();

  beforeEach(() => {
    passkeyRelayService = mock<PasskeyRelayService>();
    webAuthnLoginPrfKeyService = mock<WebAuthnLoginPrfKeyServiceAbstraction>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();
    accountService = mock<AccountService>();
    encryptService = mock<EncryptService>();
    keyService = mock<KeyService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();

    (accountService as any).activeAccount$ = activeAccount$;
    (userDecryptionOptionsService.userDecryptionOptionsById$ as jest.Mock).mockReturnValue(
      of(decryptionOptions),
    );
    (webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf as jest.Mock).mockResolvedValue(prfKey);
    (encryptService.unwrapDecapsulationKey as jest.Mock).mockResolvedValue(privateKey);
    (encryptService.decapsulateKeyUnsigned as jest.Mock).mockResolvedValue(userKey);
    i18nService.t = jest.fn((key: string) => key) as any;

    TestBed.configureTestingModule({
      providers: [
        UnlockWithPasskeyResultService,
        { provide: PasskeyRelayService, useValue: passkeyRelayService },
        { provide: WebAuthnLoginPrfKeyServiceAbstraction, useValue: webAuthnLoginPrfKeyService },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        { provide: AccountService, useValue: accountService },
        { provide: EncryptService, useValue: encryptService },
        { provide: KeyService, useValue: keyService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
      ],
    });

    service = TestBed.inject(UnlockWithPasskeyResultService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    activeAccount$.next({ id: testUserId, name: "Test Account" });
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("completeUnlock", () => {
    const buildRelayResult = (prfOutput: ArrayBuffer): PasskeyUnlockRelayResult => ({
      type: "unlock",
      credentialId,
      prfOutput,
    });

    it("returns a timeout error when there is no relay result", async () => {
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(null);

      const result = await service.completeUnlock();

      expect(result).toEqual({
        success: false,
        errorMessage: "passkeyUnlockTimeout",
        canceled: false,
      });
    });

    it("returns a timeout error when the relay result has the wrong type", async () => {
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue({
        type: "login",
        token: "token",
        assertionData: "data",
        prfOutput: null,
      } as any);

      const result = await service.completeUnlock();

      expect(result).toEqual({
        success: false,
        errorMessage: "passkeyUnlockTimeout",
        canceled: false,
      });
    });

    it("derives the PRF key, decrypts the user key, sets it, and zeros raw PRF bytes", async () => {
      const prfOutput = new Uint8Array([1, 2, 3, 4]).buffer;
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(
        buildRelayResult(prfOutput),
      );

      const result = await service.completeUnlock();

      expect(result).toEqual({ success: true });
      expect(webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf).toHaveBeenCalledWith(prfOutput);
      expect(new Uint8Array(prfOutput).every((byte) => byte === 0)).toBe(true);
      expect(encryptService.unwrapDecapsulationKey).toHaveBeenCalled();
      expect(encryptService.decapsulateKeyUnsigned).toHaveBeenCalled();
      expect(keyService.setUserKey).toHaveBeenCalledWith(userKey, testUserId);
    });

    it("returns a canceled result when the unlock is canceled", async () => {
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(
        buildRelayResult(new Uint8Array([1]).buffer),
      );
      (webAuthnLoginPrfKeyService.createSymmetricKeyFromPrf as jest.Mock).mockRejectedValue(
        new Error("User canceled"),
      );

      const result = await service.completeUnlock();

      expect(result).toEqual({ success: false, errorMessage: "", canceled: true });
    });

    it("returns the active account error when no active account exists", async () => {
      activeAccount$.next({ id: null, name: "No active account" });
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(
        buildRelayResult(new Uint8Array([1]).buffer),
      );

      const result = await service.completeUnlock();

      expect(result).toEqual({
        success: false,
        errorMessage: "No active account found",
        canceled: false,
      });
    });

    it("returns an error when the user has no WebAuthn PRF options", async () => {
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(
        buildRelayResult(new Uint8Array([1]).buffer),
      );
      (userDecryptionOptionsService.userDecryptionOptionsById$ as jest.Mock).mockReturnValue(
        of({ webAuthnPrfOptions: undefined }),
      );

      const result = await service.completeUnlock();

      expect(result).toEqual({
        success: false,
        errorMessage: "No WebAuthn PRF options available for user",
        canceled: false,
      });
    });

    it("returns an error when no matching credential is found", async () => {
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue({
        type: "unlock",
        credentialId: "unknown-credential-id",
        prfOutput: new Uint8Array([1]).buffer,
      } as any);

      const result = await service.completeUnlock();

      expect(result).toEqual({
        success: false,
        errorMessage: "No matching WebAuthn PRF option found for this credential",
        canceled: false,
      });
    });

    it("returns a generic error message for unexpected failures", async () => {
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(
        buildRelayResult(new Uint8Array([1]).buffer),
      );
      (encryptService.unwrapDecapsulationKey as jest.Mock).mockRejectedValue(
        new Error("Decryption failed"),
      );

      const result = await service.completeUnlock();

      expect(result).toEqual({
        success: false,
        errorMessage: "Decryption failed",
        canceled: false,
      });
    });

    it("falls back to the unexpectedError translation for non-Error throws", async () => {
      (passkeyRelayService.consumeResult as jest.Mock).mockResolvedValue(
        buildRelayResult(new Uint8Array([1]).buffer),
      );
      (encryptService.unwrapDecapsulationKey as jest.Mock).mockImplementation(() => {
        throw "string-error";
      });

      const result = await service.completeUnlock();

      expect(result).toEqual({
        success: false,
        errorMessage: "unexpectedError",
        canceled: false,
      });
    });
  });
});
