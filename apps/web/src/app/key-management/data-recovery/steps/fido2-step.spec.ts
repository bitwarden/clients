import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { Fido2Step } from "./fido2-step";
import { RecoveryWorkingData } from "./recovery-step";

function buildLoginCipherWithFido2(id: string, organizationId: string | null = null): Cipher {
  const encString = "2.aaa|bbb|ccc";
  const now = new Date().toISOString();
  return Cipher.fromJSON({
    id,
    organizationId,
    type: CipherType.Login,
    favorite: false,
    edit: true,
    viewPassword: true,
    organizationUseTotp: false,
    reprompt: 0,
    collectionIds: [],
    creationDate: now,
    revisionDate: now,
    login: {
      username: encString,
      fido2Credentials: [
        {
          credentialId: encString,
          keyType: encString,
          keyAlgorithm: encString,
          keyCurve: encString,
          keyValue: encString,
          rpId: encString,
          counter: encString,
          discoverable: encString,
          creationDate: now,
        },
      ],
    },
  } as any)!;
}

function buildWorkingData(ciphers: Cipher[]): RecoveryWorkingData {
  return {
    userId: "user-id" as UserId,
    userKey: null,
    encryptedPrivateKey: null,
    isPrivateKeyCorrupt: false,
    ciphers,
    folders: [],
    fido2CorruptCipherIds: [],
  };
}

describe("Fido2Step", () => {
  let fido2Step: Fido2Step;
  let cipherEncryptionService: MockProxy<CipherEncryptionService>;
  let apiService: MockProxy<ApiService>;
  let dialogService: MockProxy<DialogService>;
  let logger: MockProxy<LogRecorder>;

  const healthyView = (): CipherView => ({ decryptionFailure: false }) as CipherView;

  beforeEach(() => {
    cipherEncryptionService = mock<CipherEncryptionService>();
    apiService = mock<ApiService>();
    dialogService = mock<DialogService>();
    logger = mock<LogRecorder>();

    fido2Step = new Fido2Step(cipherEncryptionService, apiService, dialogService);
  });

  describe("runDiagnostics", () => {
    it("returns false and logs when userId is missing", async () => {
      const workingData = buildWorkingData([]);
      workingData.userId = null;

      const result = await fido2Step.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Missing user ID");
    });

    it("flags ciphers that decrypt only after removing FIDO2 credentials", async () => {
      const cipher = buildLoginCipherWithFido2("cipher-1");
      const workingData = buildWorkingData([cipher]);

      // First call: original cipher fails. Second call: stripped clone succeeds.
      cipherEncryptionService.decrypt
        .mockRejectedValueOnce(new Error("Decryption failed"))
        .mockResolvedValueOnce(healthyView());

      const result = await fido2Step.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(workingData.fido2CorruptCipherIds).toEqual(["cipher-1"]);
      expect(logger.record).toHaveBeenCalledWith("Found 1 ciphers with corrupt FIDO2 credentials");
    });

    it("does not flag ciphers that still fail after removing FIDO2 credentials", async () => {
      const cipher = buildLoginCipherWithFido2("cipher-1");
      const workingData = buildWorkingData([cipher]);

      cipherEncryptionService.decrypt.mockRejectedValue(new Error("Decryption failed"));

      const result = await fido2Step.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(workingData.fido2CorruptCipherIds).toEqual([]);
    });

    it("skips healthy FIDO2 ciphers", async () => {
      const cipher = buildLoginCipherWithFido2("cipher-1");
      const workingData = buildWorkingData([cipher]);

      cipherEncryptionService.decrypt.mockResolvedValue(healthyView());

      const result = await fido2Step.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(workingData.fido2CorruptCipherIds).toEqual([]);
      // Only the original decrypt is attempted for a healthy cipher.
      expect(cipherEncryptionService.decrypt).toHaveBeenCalledTimes(1);
    });

    it("skips organization ciphers and logins without FIDO2 credentials", async () => {
      const orgCipher = buildLoginCipherWithFido2("org-cipher", "org-1");
      const noFido2 = { id: "no-fido2", organizationId: null, type: CipherType.Login } as Cipher;
      const nonLogin = {
        id: "note",
        organizationId: null,
        type: CipherType.SecureNote,
      } as Cipher;
      const workingData = buildWorkingData([orgCipher, noFido2, nonLogin]);

      const result = await fido2Step.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(cipherEncryptionService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe("canRecover", () => {
    it("returns true only when there are corrupt FIDO2 ciphers", () => {
      const empty = buildWorkingData([]);
      expect(fido2Step.canRecover(empty)).toBe(false);

      const withCorrupt = buildWorkingData([]);
      withCorrupt.fido2CorruptCipherIds = ["cipher-1"];
      expect(fido2Step.canRecover(withCorrupt)).toBe(true);
    });
  });

  describe("runRecovery", () => {
    it("returns early when there is nothing to recover", async () => {
      const workingData = buildWorkingData([]);

      await fido2Step.runRecovery(workingData, logger);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(apiService.putCipher).not.toHaveBeenCalled();
    });

    it("throws when the user cancels", async () => {
      const cipher = buildLoginCipherWithFido2("cipher-1");
      const workingData = buildWorkingData([cipher]);
      workingData.fido2CorruptCipherIds = ["cipher-1"];

      dialogService.openSimpleDialog.mockResolvedValue(false);

      await expect(fido2Step.runRecovery(workingData, logger)).rejects.toThrow(
        "FIDO2 recovery cancelled by user",
      );
      expect(apiService.putCipher).not.toHaveBeenCalled();
    });

    it("PUTs each cipher with FIDO2 credentials removed when confirmed", async () => {
      const cipher = buildLoginCipherWithFido2("cipher-1");
      const workingData = buildWorkingData([cipher]);
      workingData.fido2CorruptCipherIds = ["cipher-1"];

      dialogService.openSimpleDialog.mockResolvedValue(true);
      apiService.putCipher.mockResolvedValue(undefined as any);

      await fido2Step.runRecovery(workingData, logger);

      expect(apiService.putCipher).toHaveBeenCalledTimes(1);
      const [id, request] = apiService.putCipher.mock.calls[0];
      expect(id).toBe("cipher-1");
      expect(request.encryptedFor).toBe(workingData.userId);
      expect(request.login.fido2Credentials).toBeUndefined();
      expect(logger.record).toHaveBeenCalledWith("Removed FIDO2 credentials from cipher cipher-1");
    });
  });
});
