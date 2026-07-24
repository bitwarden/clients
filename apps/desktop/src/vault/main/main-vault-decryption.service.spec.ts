import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherSdkService } from "@bitwarden/common/vault/abstractions/cipher-sdk.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { MainVaultDecryptionService } from "./main-vault-decryption.service";

const userId = "user-1" as UserId;

function cipherViewOfType(type: CipherType): CipherView {
  const view = new CipherView();
  view.type = type;
  return view;
}

describe("MainVaultDecryptionService", () => {
  let cipherSdkService: MockProxy<CipherSdkService>;
  let logService: MockProxy<LogService>;
  let service: MainVaultDecryptionService;

  beforeEach(() => {
    cipherSdkService = mock<CipherSdkService>();
    logService = mock<LogService>();
    service = new MainVaultDecryptionService(cipherSdkService, logService);
  });

  describe("getDecryptedCiphers", () => {
    it("returns the successfully decrypted ciphers", async () => {
      const successes = [cipherViewOfType(CipherType.Login), cipherViewOfType(CipherType.SshKey)];
      cipherSdkService.getAllDecrypted.mockResolvedValue({ successes, failures: [] });

      const result = await service.getDecryptedCiphers(userId);

      expect(cipherSdkService.getAllDecrypted).toHaveBeenCalledWith(userId);
      expect(result).toBe(successes);
      expect(logService.warning).not.toHaveBeenCalled();
    });

    it("logs a count when some ciphers fail to decrypt and omits them", async () => {
      const successes = [cipherViewOfType(CipherType.Login)];
      const failures = [cipherViewOfType(CipherType.Card), cipherViewOfType(CipherType.Card)];
      cipherSdkService.getAllDecrypted.mockResolvedValue({ successes, failures });

      const result = await service.getDecryptedCiphers(userId);

      expect(result).toBe(successes);
      expect(logService.warning).toHaveBeenCalledWith(expect.stringContaining("2 cipher(s)"));
    });

    it("propagates decryption errors", async () => {
      cipherSdkService.getAllDecrypted.mockRejectedValue(new Error("boom"));

      await expect(service.getDecryptedCiphers(userId)).rejects.toThrow("boom");
    });
  });

  describe("getDecryptedCiphersOfType", () => {
    it("returns only ciphers of the requested type", async () => {
      const login = cipherViewOfType(CipherType.Login);
      const sshKey = cipherViewOfType(CipherType.SshKey);
      cipherSdkService.getAllDecrypted.mockResolvedValue({
        successes: [login, sshKey],
        failures: [],
      });

      const result = await service.getDecryptedCiphersOfType(userId, CipherType.SshKey);

      expect(result).toEqual([sshKey]);
    });
  });
});
