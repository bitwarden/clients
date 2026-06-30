import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";

import { ExtensionUnlockViaWebAuthnComponentService } from "./extension-unlock-via-webauthn-component.service";

describe("ExtensionUnlockViaWebAuthnComponentService", () => {
  let service: ExtensionUnlockViaWebAuthnComponentService;
  let platformUtilsService: PlatformUtilsService;
  let environmentService: EnvironmentService;
  let accountService: AccountService;
  let userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction;

  const webVaultUrl = "https://vault.bitwarden.com";
  const extensionPublicKey = "extension-public-key";
  const userId = "00000000-0000-0000-0000-000000000003" as UserId;
  const credentialId = "credential-id";
  const transports = ["usb", "nfc"];

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    environmentService = mock<EnvironmentService>();
    accountService = mock<AccountService>();
    userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();

    (environmentService.environment$ as any) = of({
      getWebVaultUrl: () => webVaultUrl,
    } as Environment);
    (accountService.activeAccount$ as any) = of({ id: userId, email: "test@example.com" });
    (userDecryptionOptionsService.userDecryptionOptionsById$ as jest.Mock).mockReturnValue(
      of({
        webAuthnPrfOptions: [
          {
            credentialId,
            encryptedPrivateKey: "encrypted-private-key",
            encryptedUserKey: "encrypted-user-key",
            transports,
          },
        ],
      }),
    );

    service = new ExtensionUnlockViaWebAuthnComponentService(
      platformUtilsService,
      environmentService,
      accountService,
      userDecryptionOptionsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("shouldUseWebVaultRelay", () => {
    it("returns true for Firefox", () => {
      platformUtilsService.isFirefox = jest.fn().mockReturnValue(true);

      expect(service.shouldUseWebVaultRelay()).toBe(true);
    });

    it("returns false for non-Firefox browsers", () => {
      platformUtilsService.isFirefox = jest.fn().mockReturnValue(false);

      expect(service.shouldUseWebVaultRelay()).toBe(false);
    });
  });

  describe("openWebVaultRelayTab", () => {
    beforeEach(() => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({ result: extensionPublicKey });
    });

    it("requests an ephemeral ECDH public key and opens the unlock connector tab with credentials", async () => {
      await service.openWebVaultRelayTab();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ command: "initiatePasskeyRelay" });
      expect(userDecryptionOptionsService.userDecryptionOptionsById$).toHaveBeenCalledWith(userId);
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        expect.stringContaining(`${webVaultUrl}/passkey-connector.html#`),
      );
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        expect.stringContaining(`mode=unlock`),
      );
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        expect.stringContaining(
          `credentials=${encodeURIComponent(JSON.stringify([{ id: credentialId, transports }]))}`,
        ),
      );
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        expect.stringContaining(`extensionPublicKey=${encodeURIComponent(extensionPublicKey)}`),
      );
    });

    it("throws when the background does not return a public key", async () => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({});

      await expect(service.openWebVaultRelayTab()).rejects.toThrow(
        "Failed to initiate passkey unlock relay",
      );
    });

    it("throws when there is no active account", async () => {
      (accountService.activeAccount$ as any) = of({ id: null });

      await expect(service.openWebVaultRelayTab()).rejects.toThrow("No active account found");
    });

    it("throws when there are no PRF credentials available", async () => {
      (userDecryptionOptionsService.userDecryptionOptionsById$ as jest.Mock).mockReturnValue(
        of({ webAuthnPrfOptions: [] }),
      );

      await expect(service.openWebVaultRelayTab()).rejects.toThrow(
        "No PRF credentials available for unlock",
      );
    });
  });
});
