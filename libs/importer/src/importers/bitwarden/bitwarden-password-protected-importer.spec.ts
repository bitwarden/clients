import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { KdfType, KeyService } from "@bitwarden/key-management";

import { emptyAccountEncrypted } from "../spec-data/bitwarden-json/account-encrypted.json";
import { emptyUnencryptedExport } from "../spec-data/bitwarden-json/unencrypted.json";

import { BitwardenJsonImporter } from "./bitwarden-json-importer";
import { BitwardenPasswordProtectedImporter } from "./bitwarden-password-protected-importer";

describe("BitwardenPasswordProtectedImporter", () => {
  let importer: BitwardenPasswordProtectedImporter;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let i18nService: MockProxy<I18nService>;
  let cipherService: MockProxy<CipherService>;
  let pinService: MockProxy<PinServiceAbstraction>;
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
    pinService = mock<PinServiceAbstraction>();
    accountService = mock<AccountService>();

    importer = new BitwardenPasswordProtectedImporter(
      keyService,
      encryptService,
      i18nService,
      cipherService,
      pinService,
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
  });

  describe("Account encrypted", () => {
    beforeAll(() => {
      jest.spyOn(BitwardenJsonImporter.prototype, "parse");
    });

    it("Should call BitwardenJsonImporter", async () => {
      expect((await importer.parse(emptyAccountEncrypted)).success).toEqual(true);
      expect(BitwardenJsonImporter.prototype.parse).toHaveBeenCalledWith(emptyAccountEncrypted);
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
