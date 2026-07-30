// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { KdfConfig, KdfConfigService, KdfType } from "@bitwarden/key-management";

import { BitwardenCsvExportType, BitwardenPasswordProtectedFileFormat } from "../types";
export class BaseVaultExportService {
  constructor(
    protected pinService: PinServiceAbstraction,
    protected encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private kdfConfigService: KdfConfigService,
  ) {}

  protected async buildPasswordExport(
    userId: UserId,
    clearText: string,
    password: string,
  ): Promise<string> {
    const kdfConfig: KdfConfig = await this.kdfConfigService.getKdfConfig(userId);

    const salt = Utils.fromBufferToB64(await this.cryptoFunctionService.randomBytes(16));
    const key = await this.pinService.makePinKey(password, salt, kdfConfig);

    const encKeyValidation = await this.encryptService.encryptString(Utils.newGuid(), key);
    const encText = await this.encryptService.encryptString(clearText, key);

    const jsonDoc: BitwardenPasswordProtectedFileFormat = {
      encrypted: true,
      passwordProtected: true,
      salt: salt,
      kdfType: kdfConfig.kdfType,
      kdfIterations: kdfConfig.iterations,
      encKeyValidation_DO_NOT_EDIT: encKeyValidation.encryptedString,
      data: encText.encryptedString,
    };

    if (kdfConfig.kdfType === KdfType.Argon2id) {
      jsonDoc.kdfMemory = kdfConfig.memory;
      jsonDoc.kdfParallelism = kdfConfig.parallelism;
    }

    return JSON.stringify(jsonDoc, null, "  ");
  }

  protected buildCommonCipher(
    cipher: BitwardenCsvExportType,
    c: CipherView,
  ): BitwardenCsvExportType {
    cipher.type = null;
    cipher.name = c.name;
    cipher.notes = c.notes;
    cipher.fields = null;
    cipher.reprompt = c.reprompt;
    // Login props
    cipher.login_uri = null;
    cipher.login_username = null;
    cipher.login_password = null;
    cipher.login_totp = null;

    if (c.fields) {
      c.fields.forEach((f) => {
        if (!cipher.fields) {
          cipher.fields = "";
        } else {
          cipher.fields += "\n";
        }

        cipher.fields += (f.name || "") + ": " + f.value;
      });
    }

    switch (c.type) {
      case CipherType.Login:
        cipher.type = "login";
        cipher.login_username = c.login.username;
        cipher.login_password = c.login.password;
        cipher.login_totp = c.login.totp;

        if (c.login.uris) {
          cipher.login_uri = [];
          c.login.uris.forEach((u) => {
            cipher.login_uri.push(u.uri);
          });
        }
        break;
      case CipherType.SecureNote:
        cipher.type = "note";
        break;
      default:
        return;
    }

    return cipher;
  }
}
