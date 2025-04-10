// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  Argon2KdfConfig,
  KdfConfig,
  PBKDF2KdfConfig,
  KeyService,
  KdfType,
} from "@bitwarden/key-management";
import { BitwardenPasswordProtectedFileFormat } from "@bitwarden/vault-export-core";

import { ImportResult } from "../../models/import-result";
import { Importer } from "../importer";

import { BitwardenJsonImporter } from "./bitwarden-json-importer";

export class BitwardenPasswordProtectedImporter extends BitwardenJsonImporter implements Importer {
  private key: SymmetricCryptoKey;

  constructor(
    keyService: KeyService,
    encryptService: EncryptService,
    i18nService: I18nService,
    cipherService: CipherService,
    pinService: PinServiceAbstraction,
    accountService: AccountService,
    private promptForPassword_callback: () => Promise<string>,
  ) {
    super(keyService, encryptService, i18nService, cipherService, pinService, accountService);
  }

  async parse(data: string): Promise<ImportResult> {
    const result = new ImportResult();
    const parsedData: BitwardenPasswordProtectedFileFormat = JSON.parse(data);

    if (!parsedData) {
      result.success = false;
      return result;
    }

    // File is unencrypted
    if (!parsedData?.encrypted) {
      return await super.parse(data);
    }

    // File is account-encrypted
    if (!parsedData?.passwordProtected) {
      return await super.parse(data);
    }

    if (this.cannotParseFile(parsedData)) {
      result.success = false;
      return result;
    }

    // File is password-protected
    const password = await this.promptForPassword_callback();
    if (!(await this.checkPassword(parsedData, password))) {
      result.success = false;
      result.errorMessage = this.i18nService.t("invalidFilePassword");
      return result;
    }

    const encData = new EncString(parsedData.data);
    const clearTextData = await this.encryptService.decryptToUtf8(encData, this.key);
    return await super.parse(clearTextData);
  }

  private async checkPassword(
    jdoc: BitwardenPasswordProtectedFileFormat,
    password: string,
  ): Promise<boolean> {
    if (this.isNullOrWhitespace(password)) {
      return false;
    }

    const kdfConfig: KdfConfig =
      jdoc.kdfType === KdfType.PBKDF2_SHA256
        ? new PBKDF2KdfConfig(jdoc.kdfIterations)
        : new Argon2KdfConfig(jdoc.kdfIterations, jdoc.kdfMemory, jdoc.kdfParallelism);

    this.key = await this.pinService.makePinKey(password, jdoc.salt, kdfConfig);

    const encKeyValidation = new EncString(jdoc.encKeyValidation_DO_NOT_EDIT);

    const encKeyValidationDecrypt = await this.encryptService.decryptToUtf8(
      encKeyValidation,
      this.key,
    );
    if (encKeyValidationDecrypt === null) {
      return false;
    }
    return true;
  }

  private cannotParseFile(jdoc: BitwardenPasswordProtectedFileFormat): boolean {
    return (
      !jdoc ||
      !jdoc.encrypted ||
      !jdoc.passwordProtected ||
      !jdoc.salt ||
      !jdoc.kdfIterations ||
      typeof jdoc.kdfIterations !== "number" ||
      jdoc.kdfType == null ||
      KdfType[jdoc.kdfType] == null ||
      !jdoc.encKeyValidation_DO_NOT_EDIT ||
      !jdoc.data
    );
  }
}
