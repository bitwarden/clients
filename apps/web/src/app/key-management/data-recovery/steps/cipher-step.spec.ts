import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherPermissionsApi } from "@bitwarden/common/vault/models/api/cipher-permissions.api";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CipherDecryptionKeys, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { CipherStep } from "./cipher-step";
import { RecoveryWorkingData } from "./recovery-step";

const userId = "user-id" as UserId;
const orgA = "org-a" as OrganizationId;
const orgB = "org-b" as OrganizationId;

function personalCipher(id: string): Cipher {
  return { id, organizationId: null } as unknown as Cipher;
}

function orgCipher(id: string, organizationId: OrganizationId, canDelete = true): Cipher {
  const permissions = new CipherPermissionsApi();
  permissions.delete = canDelete;
  return { id, organizationId, permissions } as unknown as Cipher;
}

function workingDataWith(ciphers: Cipher[]): RecoveryWorkingData {
  return { userId, userKey: null, isPrivateKeyCorrupt: false, ciphers, folders: [] };
}

describe("CipherStep", () => {
  let cipherStep: CipherStep;
  let apiService: MockProxy<ApiService>;
  let cipherEncryptionService: MockProxy<CipherEncryptionService>;
  let dialogService: MockProxy<DialogService>;
  let keyService: MockProxy<KeyService>;
  let i18nService: MockProxy<I18nService>;
  let logger: MockProxy<LogRecorder>;
  let decryptionKeys$: BehaviorSubject<CipherDecryptionKeys | null>;

  /** Makes the given ciphers fail to decrypt; every other cipher succeeds. */
  const failDecryptionFor = (failing: Cipher[]) => {
    cipherEncryptionService.decryptManyLegacy.mockImplementation(async (ciphers) => [
      [],
      // decryptManyLegacy reports failures as placeholder views carrying the cipher's ID.
      ciphers.filter((c) => failing.includes(c)).map((c) => ({ id: c.id }) as CipherView),
    ]);
  };

  const logLines = () => logger.record.mock.calls.map(([line]) => line);

  beforeEach(() => {
    apiService = mock<ApiService>();
    cipherEncryptionService = mock<CipherEncryptionService>();
    dialogService = mock<DialogService>();
    keyService = mock<KeyService>();
    i18nService = mock<I18nService>();
    logger = mock<LogRecorder>();

    i18nService.t.mockImplementation((key: string, ...args: unknown[]) => [key, ...args].join(":"));

    // Both organizations' keys are available unless a test says otherwise.
    decryptionKeys$ = new BehaviorSubject<CipherDecryptionKeys | null>({
      orgKeys: { [orgA]: {} as OrgKey, [orgB]: {} as OrgKey },
    } as unknown as CipherDecryptionKeys);
    keyService.cipherDecryptionKeys$.mockReturnValue(decryptionKeys$);

    failDecryptionFor([]);

    cipherStep = new CipherStep(
      apiService,
      cipherEncryptionService,
      dialogService,
      keyService,
      i18nService,
    );
  });

  describe("runDiagnostics", () => {
    it("returns false and logs error when userId is missing", async () => {
      const result = await cipherStep.runDiagnostics(
        { ...workingDataWith([]), userId: null },
        logger,
      );

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Missing user ID");
    });

    it("decrypts personal and organization ciphers through CipherEncryptionService", async () => {
      const personal = personalCipher("personal-1");
      const org = orgCipher("org-1", orgA);

      const result = await cipherStep.runDiagnostics(workingDataWith([personal, org]), logger);

      expect(result).toBe(true);
      expect(cipherEncryptionService.decryptManyLegacy).toHaveBeenCalledWith(
        [personal, org],
        userId,
      );
    });

    it("flags corrupt personal and organization ciphers with their ownership", async () => {
      const personal = personalCipher("personal-1");
      const org = orgCipher("org-1", orgA);
      const healthy = personalCipher("personal-2");
      failDecryptionFor([personal, org]);

      const result = await cipherStep.runDiagnostics(
        workingDataWith([personal, org, healthy]),
        logger,
      );

      expect(result).toBe(false);
      expect(logLines()).toContain(
        "Cipher ID personal-1 (personal) was undecryptable (cipher key absent, item type unknown, FIDO2 credentials absent)",
      );
      expect(logLines()).toContain(
        "Cipher ID org-1 (organization org-a) was undecryptable (cipher key absent, item type unknown, FIDO2 credentials absent)",
      );
    });

    it("logs the cipher key, item type and FIDO2 credential state of an undecryptable cipher", async () => {
      const cipher = {
        id: "cipher-1",
        organizationId: null,
        key: new EncString("2.AAAA|BBBB|CCCC"),
        type: CipherType.Login,
        login: { fido2Credentials: [] },
      } as unknown as Cipher;
      failDecryptionFor([cipher]);

      await cipherStep.runDiagnostics(workingDataWith([cipher]), logger);

      expect(logLines()).toContain(
        `Cipher ID cipher-1 (personal) was undecryptable (cipher key present, item type ${CipherType.Login}, FIDO2 credentials present)`,
      );
    });

    it("skips organization ciphers whose organization key is unavailable, like the vault", async () => {
      decryptionKeys$.next({
        orgKeys: { [orgA]: {} as OrgKey },
      } as unknown as CipherDecryptionKeys);
      const personal = personalCipher("personal-1");
      const withKey = orgCipher("org-a-1", orgA);
      const withoutKey = orgCipher("org-b-1", orgB);
      failDecryptionFor([withoutKey]);

      const result = await cipherStep.runDiagnostics(
        workingDataWith([personal, withKey, withoutKey]),
        logger,
      );

      expect(result).toBe(true);
      expect(cipherEncryptionService.decryptManyLegacy).toHaveBeenCalledWith(
        [personal, withKey],
        userId,
      );
      expect(logLines()).toContain(
        "Cipher ID org-b-1 (organization org-b) was skipped: no key is available for the organization",
      );
    });

    it("checks every cipher when no organization keys are loaded, like the vault", async () => {
      decryptionKeys$.next(null);
      const org = orgCipher("org-1", orgA);

      await cipherStep.runDiagnostics(workingDataWith([org]), logger);

      expect(cipherEncryptionService.decryptManyLegacy).toHaveBeenCalledWith([org], userId);
    });

    it("does not decrypt when there is nothing to check", async () => {
      const result = await cipherStep.runDiagnostics(workingDataWith([]), logger);

      expect(result).toBe(true);
      expect(cipherEncryptionService.decryptManyLegacy).not.toHaveBeenCalled();
    });

    it("logs summary counts split by personal and organization", async () => {
      decryptionKeys$.next({
        orgKeys: { [orgA]: {} as OrgKey },
      } as unknown as CipherDecryptionKeys);
      const corruptPersonal = personalCipher("p-bad");
      const healthyPersonal = personalCipher("p-ok");
      const corruptOrg = orgCipher("o-bad", orgA);
      const healthyOrg = orgCipher("o-ok", orgA);
      const skippedOrg = orgCipher("o-skip", orgB);
      failDecryptionFor([corruptPersonal, corruptOrg]);

      await cipherStep.runDiagnostics(
        workingDataWith([corruptPersonal, healthyPersonal, corruptOrg, healthyOrg, skippedOrg]),
        logger,
      );

      expect(logLines()).toContain("Personal items: 1 undecryptable, 1 decryptable");
      expect(logLines()).toContain(
        "Organization items: 1 undecryptable, 1 decryptable, 1 skipped (organization key unavailable)",
      );
      expect(logLines()).toContain("Found 2 undecryptable ciphers");
      expect(logLines()).toContain("Found 2 decryptable ciphers");
    });

    it("reports corrupt organization ciphers the user cannot delete", async () => {
      const notDeletable = orgCipher("org-1", orgA, false);
      failDecryptionFor([notDeletable]);

      await cipherStep.runDiagnostics(
        workingDataWith([notDeletable, orgCipher("org-ok", orgA), personalCipher("ok")]),
        logger,
      );

      expect(logLines()).toContain(
        "Cipher ID org-1 (organization org-a) cannot be deleted: the user lacks delete permission",
      );
      expect(cipherStep.message).toBe("recoveryOrgItemsContactSupport:1");
    });

    it("throws a readable error when decryption cannot run at all", async () => {
      cipherEncryptionService.decryptManyLegacy.mockRejectedValue(
        new Error("no elements in sequence"),
      );

      await expect(
        cipherStep.runDiagnostics(workingDataWith([personalCipher("p")]), logger),
      ).rejects.toThrow("Vault item decryption could not run: no elements in sequence");
    });

    it("resets results between runs", async () => {
      const cipher = personalCipher("p");
      failDecryptionFor([cipher]);
      expect(await cipherStep.runDiagnostics(workingDataWith([cipher]), logger)).toBe(false);

      failDecryptionFor([]);
      expect(await cipherStep.runDiagnostics(workingDataWith([cipher]), logger)).toBe(true);
      expect(cipherStep.message).toBeUndefined();
    });
  });

  describe("canRecover", () => {
    it("returns false when there are no undecryptable ciphers", async () => {
      await cipherStep.runDiagnostics(workingDataWith([personalCipher("p")]), logger);

      expect(cipherStep.canRecover(workingDataWith([]))).toBe(false);
    });

    it("returns true when a deletable cipher is corrupt and another item under its key decrypts", async () => {
      const bad = orgCipher("org-1", orgA);
      failDecryptionFor([bad]);
      await cipherStep.runDiagnostics(workingDataWith([bad, orgCipher("org-ok", orgA)]), logger);

      expect(cipherStep.canRecover(workingDataWith([]))).toBe(true);
    });

    it("returns false when every cipher fails to decrypt", async () => {
      const a = personalCipher("a");
      const b = personalCipher("b");
      failDecryptionFor([a, b]);
      await cipherStep.runDiagnostics(workingDataWith([a, b]), logger);

      expect(cipherStep.canRecover(workingDataWith([]))).toBe(false);
    });

    it("returns false when the only corrupt ciphers cannot be deleted by the user", async () => {
      const bad = orgCipher("org-1", orgA, false);
      failDecryptionFor([bad]);
      await cipherStep.runDiagnostics(workingDataWith([bad, orgCipher("org-ok", orgA)]), logger);

      expect(cipherStep.canRecover(workingDataWith([]))).toBe(false);
    });
  });

  describe("deletion safeguard per key", () => {
    it("does not offer personal items for deletion when every personal item fails, even if org items decrypt", async () => {
      const a = personalCipher("p-a");
      const b = personalCipher("p-b");
      failDecryptionFor([a, b]);

      await cipherStep.runDiagnostics(workingDataWith([a, b, orgCipher("org-ok", orgA)]), logger);

      expect(cipherStep.canRecover(workingDataWith([]))).toBe(false);
      expect(logLines()).toContain(
        "Cipher ID p-a (personal) cannot be deleted: no other item encrypted with the same key decrypts",
      );
    });

    it("does not offer an organization's items for deletion when every item in it fails, even with delete permission", async () => {
      const a = orgCipher("org-a-1", orgA);
      const b = orgCipher("org-a-2", orgA);
      failDecryptionFor([a, b]);

      await cipherStep.runDiagnostics(workingDataWith([a, b, personalCipher("ok")]), logger);

      expect(cipherStep.canRecover(workingDataWith([]))).toBe(false);
      expect(logLines()).toContain(
        "Cipher ID org-a-1 (organization org-a) cannot be deleted: no other item encrypted with the same key decrypts",
      );
      expect(cipherStep.message).toBe("recoveryOrgItemsContactSupport:2");
    });

    it("judges each organization separately", async () => {
      const brokenInA = orgCipher("org-a-bad", orgA);
      const onlyItemInB = orgCipher("org-b-bad", orgB);
      failDecryptionFor([brokenInA, onlyItemInB]);

      await cipherStep.runDiagnostics(
        workingDataWith([brokenInA, orgCipher("org-a-ok", orgA), onlyItemInB]),
        logger,
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);
      await cipherStep.runRecovery(workingDataWith([]), logger);

      expect(apiService.deleteCipher).toHaveBeenCalledWith("org-a-bad");
      expect(apiService.deleteCipher).not.toHaveBeenCalledWith("org-b-bad");
    });

    it("logs every reason an item cannot be deleted", async () => {
      const locked = orgCipher("org-a-locked", orgA, false);
      failDecryptionFor([locked]);

      await cipherStep.runDiagnostics(workingDataWith([locked, personalCipher("ok")]), logger);

      expect(logLines()).toContain(
        "Cipher ID org-a-locked (organization org-a) cannot be deleted: no other item encrypted with the same key decrypts; the user lacks delete permission",
      );
    });
  });

  describe("runRecovery", () => {
    const personalBad = personalCipher("p-bad");
    const orgBad = orgCipher("o-bad", orgA);
    const orgBadNoPermission = orgCipher("o-locked", orgA, false);

    beforeEach(async () => {
      failDecryptionFor([personalBad, orgBad, orgBadNoPermission]);
      await cipherStep.runDiagnostics(
        workingDataWith([
          personalBad,
          orgBad,
          orgBadNoPermission,
          personalCipher("ok"),
          orgCipher("o-ok", orgA),
        ]),
        logger,
      );
      logger.record.mockClear();
    });

    it("logs and returns early when there are no deletable ciphers", async () => {
      failDecryptionFor([]);
      await cipherStep.runDiagnostics(workingDataWith([personalCipher("ok")]), logger);

      await cipherStep.runRecovery(workingDataWith([]), logger);

      expect(logger.record).toHaveBeenCalledWith("No undecryptable ciphers to recover");
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("states what will be deleted and the undecryptable items that will be left unchanged", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await cipherStep.runRecovery(workingDataWith([]), logger);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "recoveryDeleteCiphersWithUndeletableDesc", placeholders: [2, 1] },
          type: "danger",
        }),
      );
    });

    it("omits the left-unchanged count when every undecryptable item can be deleted", async () => {
      failDecryptionFor([personalBad, orgBad]);
      await cipherStep.runDiagnostics(
        workingDataWith([personalBad, orgBad, personalCipher("ok"), orgCipher("o-ok", orgA)]),
        logger,
      );
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await cipherStep.runRecovery(workingDataWith([]), logger);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "recoveryDeleteCiphersCountDesc", placeholders: [2] },
        }),
      );
    });

    it("throws when the user cancels deletion", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await expect(cipherStep.runRecovery(workingDataWith([]), logger)).rejects.toThrow(
        "Cipher recovery cancelled by user",
      );
      expect(apiService.deleteCipher).not.toHaveBeenCalled();
    });

    it("deletes only the ciphers the user is allowed to delete", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await cipherStep.runRecovery(workingDataWith([]), logger);

      expect(apiService.deleteCipher).toHaveBeenCalledWith("p-bad");
      expect(apiService.deleteCipher).toHaveBeenCalledWith("o-bad");
      expect(apiService.deleteCipher).not.toHaveBeenCalledWith("o-locked");
      expect(logger.record).toHaveBeenCalledWith("Deleted cipher o-bad (organization org-a)");
      expect(logger.record).toHaveBeenCalledWith("Successfully deleted 2 ciphers");
    });

    it("keeps deleting after a failure and then reports the partial failure", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      apiService.deleteCipher.mockRejectedValueOnce(new Error("Forbidden"));

      await expect(cipherStep.runRecovery(workingDataWith([]), logger)).rejects.toThrow(
        "Failed to delete 1 of 2 ciphers",
      );

      expect(apiService.deleteCipher).toHaveBeenCalledTimes(2);
      expect(logger.record).toHaveBeenCalledWith(
        "Failed to delete cipher p-bad (personal): Forbidden",
      );
      expect(logger.record).toHaveBeenCalledWith("Deleted cipher o-bad (organization org-a)");
    });
  });
});
