import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { emptyGuid, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey, UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, KdfType, KeyGenerationService } from "@bitwarden/legacy-crypto";
import { UserId } from "@bitwarden/user-core";

import { ImportRecordError, ImportRecordErrorReason } from "../../models/import-record-error";
import { emptyAccountEncrypted } from "../spec-data/bitwarden-json/account-encrypted.json";
import {
  emptyUnencryptedExport,
  unencryptedExportWithCipherKey,
} from "../spec-data/bitwarden-json/unencrypted.json";

import { BitwardenEncryptedJsonImporter } from "./bitwarden-encrypted-json-importer";
import { BitwardenJsonImporter } from "./bitwarden-json-importer";
import { BitwardenPasswordProtectedImporter } from "./bitwarden-password-protected-importer";

describe("BitwardenPasswordProtectedImporter", () => {
  let importer: BitwardenPasswordProtectedImporter;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let cipherService: MockProxy<CipherService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let accountService: MockProxy<AccountService>;
  const password = Utils.newGuid();
  const promptForPassword_callback = async () => {
    return password;
  };

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    cipherService = mock<CipherService>();
    keyGenerationService = mock<KeyGenerationService>();
    accountService = mock<AccountService>();

    accountService.activeAccount$ = of({
      id: emptyGuid as UserId,
      ...mockAccountInfoWith({
        email: "test@example.com",
        name: "Test User",
      }),
    });

    const mockOrgId = emptyGuid as OrganizationId;
    /*
      The key values below are never read, empty objects are cast as types for compilation type checking only.
      Tests specific to key contents are in key-service.spec.ts
    */
    const mockOrgKey = {} as OrgKey;
    const mockUserKey = {} as UserKey;

    keyService.orgKeys$.mockImplementation(() =>
      of({ [mockOrgId]: mockOrgKey } as Record<OrganizationId, OrgKey>),
    );
    keyService.userKey$.mockImplementation(() => of(mockUserKey));

    /*
      Crypto isn’t under test here; keys are just placeholders.
      Decryption methods are stubbed to always return empty CipherView or string allowing OK import flow.
    */
    cipherService.decrypt.mockResolvedValue({} as any);
    encryptService.decryptString.mockResolvedValue("ok");

    importer = new BitwardenPasswordProtectedImporter(
      keyService,
      encryptService,
      i18nService,
      cipherService,
      keyGenerationService,
      accountService,
      promptForPassword_callback,
    );
  });

  describe("Unencrypted", () => {
    beforeAll(() => {
      jest.spyOn(BitwardenJsonImporter.prototype, "parse");
    });

    it("Should call BitwardenJsonImporter", async () => {
      expect((await importer.parse(emptyUnencryptedExport)).success).toEqual(true);
      expect(BitwardenJsonImporter.prototype.parse).toHaveBeenCalledWith(emptyUnencryptedExport);
    });

    it("drops the per-cipher key so key-bearing exports import successfully", async () => {
      const result = await importer.parse(unencryptedExportWithCipherKey);

      expect(result.success).toEqual(true);
      expect(result.ciphers).toHaveLength(1);
      expect(result.ciphers[0].key).toBeNull();
    });
  });

  describe("Account encrypted", () => {
    beforeAll(() => {
      jest.spyOn(BitwardenEncryptedJsonImporter.prototype, "parse");
    });

    beforeEach(() => {
      accountService.activeAccount$ = of({
        id: emptyGuid as UserId,
        ...mockAccountInfoWith({
          email: "test@example.com",
          name: "Test User",
        }),
      });
      importer = new BitwardenPasswordProtectedImporter(
        keyService,
        encryptService,
        i18nService,
        cipherService,
        keyGenerationService,
        accountService,
        promptForPassword_callback,
      );
    });

    it("Should call BitwardenEncryptedJsonImporter", async () => {
      expect((await importer.parse(emptyAccountEncrypted)).success).toEqual(false);
      expect(BitwardenEncryptedJsonImporter.prototype.parse).toHaveBeenCalledWith(
        emptyAccountEncrypted,
      );
    });

    it("skips an SSH key item with a null private key instead of hanging, and still imports everything else", async () => {
      const exportWithMalformedSshKey = JSON.stringify({
        encrypted: true,
        encKeyValidation_DO_NOT_EDIT: "2.iv|data|mac=",
        folders: [],
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            type: CipherType.Login,
            name: "2.iv|name|mac=",
            login: { username: "2.iv|user|mac=", password: "2.iv|pass|mac=" },
          },
          {
            id: "22222222-2222-2222-2222-222222222222",
            type: CipherType.SshKey,
            name: "2.iv|name|mac=",
            sshKey: { privateKey: null, publicKey: null, keyFingerprint: null },
          },
        ],
      });

      const result = await importer.parse(exportWithMalformedSshKey);

      expect(result.success).toBe(true);
      expect(result.ciphers).toHaveLength(1);
      expect(cipherService.decrypt).toHaveBeenCalledTimes(1);
      expect(result.errors).toEqual([
        new ImportRecordError(
          "22222222-2222-2222-2222-222222222222",
          ImportRecordErrorReason.SshKeyParseFailed,
        ),
      ]);
    });

    it("skips a legacy SSH key item that only carries server data, as in exports affected by PM-44643", async () => {
      const exportWithServerDataSshKey = JSON.stringify({
        encrypted: true,
        encKeyValidation_DO_NOT_EDIT: "2.iv|data|mac=",
        folders: [],
        items: [
          {
            id: "44444444-4444-4444-4444-444444444444",
            type: CipherType.SshKey,
            name: "2.iv|name|mac=",
            data: JSON.stringify({ PrivateKey: "2.iv|pk|mac=", Name: "2.iv|name|mac=" }),
          },
        ],
      });

      const result = await importer.parse(exportWithServerDataSshKey);

      expect(cipherService.decrypt).not.toHaveBeenCalled();
      expect(result.errors).toEqual([
        new ImportRecordError(
          "44444444-4444-4444-4444-444444444444",
          ImportRecordErrorReason.SshKeyParseFailed,
        ),
      ]);
    });

    it("doesn't skip a V2 (blob) SSH key item, which has no top-level sshKey field at all", async () => {
      // V2 ciphers seal all content in `data`; a valid V2 SSH key item never carries a top-level
      // sshKey property, so sshKey?.privateKey is always undefined there. Only c.data == null
      // (V1, field-level) items should be checked for a missing private key.
      const exportWithV2SshKey = JSON.stringify({
        encrypted: true,
        encKeyValidation_DO_NOT_EDIT: "2.iv|data|mac=",
        folders: [],
        items: [
          {
            id: "33333333-3333-3333-3333-333333333333",
            type: CipherType.SshKey,
            name: "",
            data: JSON.stringify({ format_version: 1, wrapped_cek: "2.iv|cek|mac=" }),
          },
        ],
      });

      const result = await importer.parse(exportWithV2SshKey);

      expect(result.success).toBe(true);
      expect(result.ciphers).toHaveLength(1);
      expect(cipherService.decrypt).toHaveBeenCalledTimes(1);
      expect(result.errors).toEqual([]);
    });
  });

  describe("Password protected", () => {
    let jDoc: {
      encrypted?: boolean;
      passwordProtected?: boolean;
      salt?: string;
      kdfIterations?: any;
      kdfType?: any;
      encKeyValidation_DO_NOT_EDIT?: string;
      data?: string;
    };

    beforeEach(() => {
      jDoc = {
        encrypted: true,
        passwordProtected: true,
        salt: "c2FsdA==",
        kdfIterations: 100000,
        kdfType: KdfType.PBKDF2_SHA256,
        encKeyValidation_DO_NOT_EDIT: Utils.newGuid(),
        data: Utils.newGuid(),
      };
    });

    it("succeeds with default jdoc", async () => {
      encryptService.decryptString.mockReturnValue(Promise.resolve(emptyUnencryptedExport));

      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(true);
    });

    it("fails if salt === null", async () => {
      jDoc.salt = null;
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("fails if kdfIterations === null", async () => {
      jDoc.kdfIterations = null;
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("fails if kdfIterations is not a number", async () => {
      jDoc.kdfIterations = "not a number";
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("fails if kdfType === null", async () => {
      jDoc.kdfType = null;
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("fails if kdfType is not a string", async () => {
      jDoc.kdfType = "not a valid kdf type";
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("fails if kdfType is not a known kdfType", async () => {
      jDoc.kdfType = -1;
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("fails if encKeyValidation_DO_NOT_EDIT === null", async () => {
      jDoc.encKeyValidation_DO_NOT_EDIT = null;
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("fails if data === null", async () => {
      jDoc.data = null;
      expect((await importer.parse(JSON.stringify(jDoc))).success).toEqual(false);
    });

    it("returns invalidFilePassword errorMessage if decryptString throws", async () => {
      encryptService.decryptString.mockImplementation(() => {
        throw new Error("SDK error");
      });
      i18nService.t.mockReturnValue("invalidFilePassword");

      const result = await importer.parse(JSON.stringify(jDoc));

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("invalidFilePassword");
    });
  });
});
