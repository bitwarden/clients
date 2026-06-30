import { webcrypto } from "crypto";

import { mock } from "jest-mock-extended";

import { LockService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProcessReloadServiceAbstraction } from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";

import { PasskeyRelayService } from "../auth/services/passkey-relay.service";
import { AutofillService } from "../autofill/services/abstractions/autofill.service";
import BrowserPopupUtils from "../platform/browser/browser-popup-utils";
import { BrowserEnvironmentService } from "../platform/services/browser-environment.service";
import BrowserInitialInstallService from "../platform/services/browser-initial-install.service";
import { BrowserPlatformUtilsService } from "../platform/services/platform-utils/browser-platform-utils.service";

import MainBackground from "./main.background";
import RuntimeBackground from "./runtime.background";

describe("RuntimeBackground passkey relay support", () => {
  let runtimeBackground: RuntimeBackground;
  let passkeyRelayService: PasskeyRelayService;
  let logService: LogService;

  const buildRuntimeBackground = () => {
    return new RuntimeBackground(
      mock<MainBackground>() as unknown as MainBackground,
      mock<AutofillService>(),
      mock<BrowserPlatformUtilsService>(),
      mock<AutofillSettingsServiceAbstraction>(),
      mock<ProcessReloadServiceAbstraction>(),
      mock<BrowserEnvironmentService>(),
      mock<MessagingService>(),
      logService,
      mock<ConfigService>(),
      mock<MessageListener>(),
      mock<AccountService>(),
      mock<LockService>(),
      mock<BillingAccountProfileStateService>(),
      mock<BrowserInitialInstallService>(),
      passkeyRelayService,
    );
  };

  beforeAll(() => {
    // Make Web Crypto available to RuntimeBackground, which uses the global crypto object.
    Object.defineProperty(globalThis, "crypto", { value: webcrypto });
    Object.defineProperty(globalThis, "CryptoKey", { value: webcrypto.CryptoKey });

    // RuntimeBackground wires up several extension event listeners in its constructor.
    const chromeRuntime = (global as any).chrome.runtime;
    chromeRuntime.onInstalled = { addListener: jest.fn() };
    (global as any).chrome.permissions = {
      ...((global as any).chrome.permissions ?? {}),
      onAdded: { addListener: jest.fn() },
    };
  });

  beforeEach(() => {
    passkeyRelayService = mock<PasskeyRelayService>();
    logService = mock<LogService>();
    runtimeBackground = buildRuntimeBackground();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("initiatePasskeyRelay", () => {
    it("generates an ECDH key pair and returns the base64url-encoded public key", async () => {
      const publicKey = await runtimeBackground.initiatePasskeyRelay();

      expect(publicKey).toBeTruthy();
      expect(publicKey).not.toContain("+");
      expect(publicKey).not.toContain("/");
      expect(publicKey).not.toContain("=");
    });

    it("stores a pending session with a private key and a future expiry", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);

      await runtimeBackground.initiatePasskeyRelay();

      const session = (runtimeBackground as any).pendingPasskeyLoginEcdhSession;
      expect(session).toBeTruthy();
      expect(session.privateKey.type).toBe("private");
      expect(session.expiresAt).toBeGreaterThan(now);
      expect(session.expiresAt).toBeLessThanOrEqual(now + 5 * 60 * 1000);
    });

    it("replaces any existing pending session", async () => {
      const originalPrivateKey = {} as CryptoKey;
      (runtimeBackground as any).pendingPasskeyLoginEcdhSession = {
        privateKey: originalPrivateKey,
        expiresAt: Date.now() + 1000,
      };

      await runtimeBackground.initiatePasskeyRelay();
      const session2 = (runtimeBackground as any).pendingPasskeyLoginEcdhSession;

      expect(session2.privateKey).not.toBe(originalPrivateKey);
      expect(session2.privateKey.type).toBe("private");
    });
  });

  describe("handlePasskeyResult", () => {
    const validLoginMsg = {
      type: "login" as const,
      token: "login-token",
      assertionData: "{}",
      referrer: "https://vault.bitwarden.com",
    };

    const validUnlockMsg = {
      type: "unlock" as const,
      credentialId: "credential-id",
      referrer: "https://vault.bitwarden.com",
    };

    const setValidSession = () => {
      (runtimeBackground as any).pendingPasskeyLoginEcdhSession = {
        privateKey: {} as CryptoKey,
        expiresAt: Date.now() + 60 * 1000,
      };
    };

    beforeEach(() => {
      (passkeyRelayService.storeResult as jest.Mock).mockResolvedValue(undefined);
      jest.spyOn(BrowserPopupUtils as any, "openPopout").mockResolvedValue(undefined);
    });

    it("stores a login result and opens the login result popout", async () => {
      setValidSession();

      await (runtimeBackground as any).handlePasskeyResult(validLoginMsg);

      expect(passkeyRelayService.storeResult).toHaveBeenCalledWith({
        type: "login",
        token: validLoginMsg.token,
        assertionData: validLoginMsg.assertionData,
        prfOutput: null,
      });
      expect(BrowserPopupUtils.openPopout).toHaveBeenCalledWith(
        "popup/index.html#/login-with-passkey-result",
        { singleActionKey: "auth_passkeyResult" },
      );
    });

    it("stores an unlock result and opens the unlock result popout", async () => {
      setValidSession();

      await (runtimeBackground as any).handlePasskeyResult(validUnlockMsg);

      expect(passkeyRelayService.storeResult).toHaveBeenCalledWith({
        type: "unlock",
        credentialId: validUnlockMsg.credentialId,
        prfOutput: null,
      });
      expect(BrowserPopupUtils.openPopout).toHaveBeenCalledWith(
        "popup/index.html#/unlock-with-passkey-result",
        { singleActionKey: "auth_passkeyResult" },
      );
    });

    it("passes decrypted PRF output through to the unlock result", async () => {
      setValidSession();
      const decryptedPrf = new Uint8Array([1, 2, 3]).buffer;
      jest.spyOn(runtimeBackground as any, "decryptPrfOutput").mockResolvedValue(decryptedPrf);

      await (runtimeBackground as any).handlePasskeyResult({
        ...validUnlockMsg,
        encryptedPrfOutput: { ciphertext: "cipher", iv: "iv" },
        connectorPublicKey: "connector-key",
      });

      expect(passkeyRelayService.storeResult).toHaveBeenCalledWith({
        type: "unlock",
        credentialId: validUnlockMsg.credentialId,
        prfOutput: decryptedPrf,
      });
    });

    it("does nothing when no passkey session is pending", async () => {
      await (runtimeBackground as any).handlePasskeyResult(validLoginMsg);

      expect(passkeyRelayService.storeResult).not.toHaveBeenCalled();
      expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
      expect(logService.error).toHaveBeenCalledWith(
        "[PasskeyLogin] No pending passkey session or session expired",
      );
    });

    it("does nothing when the pending passkey session is expired", async () => {
      (runtimeBackground as any).pendingPasskeyLoginEcdhSession = {
        privateKey: {} as CryptoKey,
        expiresAt: Date.now() - 1000,
      };

      await (runtimeBackground as any).handlePasskeyResult(validLoginMsg);

      expect(passkeyRelayService.storeResult).not.toHaveBeenCalled();
      expect(BrowserPopupUtils.openPopout).not.toHaveBeenCalled();
    });

    it("decrypts encrypted PRF output and passes it to the relay service", async () => {
      setValidSession();
      const decryptedPrf = new Uint8Array([1, 2, 3]).buffer;
      const decryptSpy = jest
        .spyOn(runtimeBackground as any, "decryptPrfOutput")
        .mockResolvedValue(decryptedPrf);

      await (runtimeBackground as any).handlePasskeyResult({
        ...validLoginMsg,
        encryptedPrfOutput: { ciphertext: "cipher", iv: "iv" },
        connectorPublicKey: "connector-key",
      });

      expect(decryptSpy).toHaveBeenCalledWith("cipher", "iv", "connector-key");
      expect(passkeyRelayService.storeResult).toHaveBeenCalledWith({
        type: "login",
        token: validLoginMsg.token,
        assertionData: validLoginMsg.assertionData,
        prfOutput: decryptedPrf,
      });
    });

    it("clears the pending session even when an error occurs", async () => {
      setValidSession();
      (passkeyRelayService.storeResult as jest.Mock).mockRejectedValue(new Error("storage error"));

      await (runtimeBackground as any).handlePasskeyResult(validLoginMsg);

      expect((runtimeBackground as any).pendingPasskeyLoginEcdhSession).toBeNull();
      expect(logService.error).toHaveBeenCalled();
    });
  });
});
