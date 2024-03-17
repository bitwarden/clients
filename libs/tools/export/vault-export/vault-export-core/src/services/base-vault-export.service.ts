import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KdfType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BitwardenCsvExportType, BitwardenPasswordProtectedFileFormat } from "../types";
export class BaseVaultExportService {
  constructor(
    protected cryptoService: CryptoService,
    private cryptoFunctionService: CryptoFunctionService,
    private stateService: StateService,
  ) {}

  protected async buildPasswordExport(clearText: string, password: string): Promise<string> {
    const kdfType: KdfType = await this.stateService.getKdfType();
    const kdfConfig: KdfConfig = await this.stateService.getKdfConfig();

    const salt = Utils.fromBufferToB64(await this.cryptoFunctionService.randomBytes(16));
    const key = await this.cryptoService.makePinKey(password, salt, kdfType, kdfConfig);

    const encKeyValidation = await this.cryptoService.encrypt(Utils.newGuid(), key);
    const encText = await this.cryptoService.encrypt(clearText, key);

    const jsonDoc: BitwardenPasswordProtectedFileFormat = {
      encrypted: true,
      passwordProtected: true,
      salt: salt,
      kdfType: kdfType,
      kdfIterations: kdfConfig.iterations,
      kdfMemory: kdfConfig.memory,
      kdfParallelism: kdfConfig.parallelism,
      encKeyValidation_DO_NOT_EDIT: encKeyValidation.encryptedString,
      data: encText.encryptedString,
    };

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
