import { Jsonify } from "type-fest";

import { OrganizationData } from "../../../admin-console/models/data/organization.data";
import { AdminAuthRequestStorable } from "../../../auth/models/domain/admin-auth-req-storable";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { KeyConnectorUserDecryptionOption } from "../../../auth/models/domain/user-decryption-options/key-connector-user-decryption-option";
import { TrustedDeviceUserDecryptionOption } from "../../../auth/models/domain/user-decryption-options/trusted-device-user-decryption-option";
import { IdentityTokenResponse } from "../../../auth/models/response/identity-token.response";
import { EventData } from "../../../models/data/event.data";
import { UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { GeneratorOptions } from "../../../tools/generator/generator-options";
import {
  GeneratedPasswordHistory,
  PasswordGeneratorOptions,
} from "../../../tools/generator/password";
import { UsernameGeneratorOptions } from "../../../tools/generator/username/username-generation-options";
import { SendData } from "../../../tools/send/models/data/send.data";
import { SendView } from "../../../tools/send/models/view/send.view";
import { DeepJsonify } from "../../../types/deep-jsonify";
import { MasterKey } from "../../../types/key";
import { CipherData } from "../../../vault/models/data/cipher.data";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { AddEditCipherInfo } from "../../../vault/types/add-edit-cipher-info";
import { KdfType } from "../../enums";
import { Utils } from "../../misc/utils";
import { ServerConfigData } from "../../models/data/server-config.data";

import { EncryptedString, EncString } from "./enc-string";
import { SymmetricCryptoKey } from "./symmetric-crypto-key";

export class EncryptionPair<TEncrypted, TDecrypted> {
  encrypted?: TEncrypted;
  decrypted?: TDecrypted;

  toJSON() {
    return {
      encrypted: this.encrypted,
      decrypted:
        this.decrypted instanceof ArrayBuffer
          ? Utils.fromBufferToByteString(this.decrypted)
          : this.decrypted,
    };
  }

  static fromJSON<TEncrypted, TDecrypted>(
    obj: { encrypted?: Jsonify<TEncrypted>; decrypted?: string | Jsonify<TDecrypted> },
    decryptedFromJson?: (decObj: Jsonify<TDecrypted> | string) => TDecrypted,
    encryptedFromJson?: (encObj: Jsonify<TEncrypted>) => TEncrypted,
  ) {
    if (obj == null) {
      return null;
    }

    const pair = new EncryptionPair<TEncrypted, TDecrypted>();
    if (obj?.encrypted != null) {
      pair.encrypted = encryptedFromJson
        ? encryptedFromJson(obj.encrypted)
        : (obj.encrypted as TEncrypted);
    }
    if (obj?.decrypted != null) {
      pair.decrypted = decryptedFromJson
        ? decryptedFromJson(obj.decrypted)
        : (obj.decrypted as TDecrypted);
    }
    return pair;
  }
}

export class DataEncryptionPair<TEncrypted, TDecrypted> {
  encrypted?: Record<string, TEncrypted>;
  decrypted?: TDecrypted[];
}

// This is a temporary structure to handle migrated `DataEncryptionPair` to
//  avoid needing a data migration at this stage. It should be replaced with
//  proper data migrations when `DataEncryptionPair` is deprecated.
export class TemporaryDataEncryption<TEncrypted> {
  encrypted?: { [id: string]: TEncrypted };
}

export class AccountData {
  ciphers?: DataEncryptionPair<CipherData, CipherView> = new DataEncryptionPair<
    CipherData,
    CipherView
  >();
  localData?: any;
  sends?: DataEncryptionPair<SendData, SendView> = new DataEncryptionPair<SendData, SendView>();
  passwordGenerationHistory?: EncryptionPair<
    GeneratedPasswordHistory[],
    GeneratedPasswordHistory[]
  > = new EncryptionPair<GeneratedPasswordHistory[], GeneratedPasswordHistory[]>();
  addEditCipherInfo?: AddEditCipherInfo;
  eventCollection?: EventData[];
  organizations?: { [id: string]: OrganizationData };

  static fromJSON(obj: DeepJsonify<AccountData>): AccountData {
    if (obj == null) {
      return null;
    }

    return Object.assign(new AccountData(), obj, {
      addEditCipherInfo: {
        cipher: CipherView.fromJSON(obj?.addEditCipherInfo?.cipher),
        collectionIds: obj?.addEditCipherInfo?.collectionIds,
      },
    });
  }
}

export class AccountKeys {
  masterKey?: MasterKey;
  masterKeyEncryptedUserKey?: string;
  deviceKey?: ReturnType<SymmetricCryptoKey["toJSON"]>;
  publicKey?: Uint8Array;

  /** @deprecated July 2023, left for migration purposes*/
  cryptoMasterKey?: SymmetricCryptoKey;
  /** @deprecated July 2023, left for migration purposes*/
  cryptoMasterKeyAuto?: string;
  /** @deprecated July 2023, left for migration purposes*/
  cryptoMasterKeyBiometric?: string;
  /** @deprecated July 2023, left for migration purposes*/
  cryptoSymmetricKey?: EncryptionPair<string, SymmetricCryptoKey> = new EncryptionPair<
    string,
    SymmetricCryptoKey
  >();

  toJSON() {
    // If you pass undefined into fromBufferToByteString, you will get an empty string back
    // which will cause all sorts of headaches down the line when you try to getPublicKey
    // and expect a Uint8Array and get an empty string instead.
    return Utils.merge(this, {
      publicKey: this.publicKey ? Utils.fromBufferToByteString(this.publicKey) : undefined,
    });
  }

  static fromJSON(obj: DeepJsonify<AccountKeys>): AccountKeys {
    if (obj == null) {
      return null;
    }
    return Object.assign(new AccountKeys(), obj, {
      masterKey: SymmetricCryptoKey.fromJSON(obj?.masterKey),
      deviceKey: obj?.deviceKey,
      cryptoMasterKey: SymmetricCryptoKey.fromJSON(obj?.cryptoMasterKey),
      cryptoSymmetricKey: EncryptionPair.fromJSON(
        obj?.cryptoSymmetricKey,
        SymmetricCryptoKey.fromJSON,
      ),
      publicKey: Utils.fromByteStringToArray(obj?.publicKey),
    });
  }

  static initRecordEncryptionPairsFromJSON(obj: any) {
    return EncryptionPair.fromJSON(obj, (decObj: any) => {
      if (obj == null) {
        return null;
      }

      const record: Record<string, SymmetricCryptoKey> = {};
      for (const id in decObj) {
        record[id] = SymmetricCryptoKey.fromJSON(decObj[id]);
      }
      return record;
    });
  }
}

export class AccountProfile {
  convertAccountToKeyConnector?: boolean;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  everBeenUnlocked?: boolean;
  forceSetPasswordReason?: ForceSetPasswordReason;
  lastSync?: string;
  userId?: string;
  usesKeyConnector?: boolean;
  keyHash?: string;
  kdfIterations?: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  kdfType?: KdfType;

  static fromJSON(obj: Jsonify<AccountProfile>): AccountProfile {
    if (obj == null) {
      return null;
    }

    return Object.assign(new AccountProfile(), obj);
  }
}

export class AccountSettings {
  autoConfirmFingerPrints?: boolean;
  defaultUriMatch?: UriMatchStrategySetting;
  disableGa?: boolean;
  enableAlwaysOnTop?: boolean;
  enableBiometric?: boolean;
  minimizeOnCopyToClipboard?: boolean;
  passwordGenerationOptions?: PasswordGeneratorOptions;
  usernameGenerationOptions?: UsernameGeneratorOptions;
  generatorOptions?: GeneratorOptions;
  pinKeyEncryptedUserKey?: EncryptedString;
  pinKeyEncryptedUserKeyEphemeral?: EncryptedString;
  protectedPin?: string;
  vaultTimeout?: number;
  vaultTimeoutAction?: string = "lock";
  serverConfig?: ServerConfigData;
  approveLoginRequests?: boolean;
  avatarColor?: string;
  trustDeviceChoiceForDecryption?: boolean;

  /** @deprecated July 2023, left for migration purposes*/
  pinProtected?: EncryptionPair<string, EncString> = new EncryptionPair<string, EncString>();

  static fromJSON(obj: Jsonify<AccountSettings>): AccountSettings {
    if (obj == null) {
      return null;
    }

    return Object.assign(new AccountSettings(), obj, {
      pinProtected: EncryptionPair.fromJSON<string, EncString>(
        obj?.pinProtected,
        EncString.fromJSON,
      ),
      serverConfig: ServerConfigData.fromJSON(obj?.serverConfig),
    });
  }
}

export class AccountTokens {
  securityStamp?: string;

  static fromJSON(obj: Jsonify<AccountTokens>): AccountTokens {
    if (obj == null) {
      return null;
    }

    return Object.assign(new AccountTokens(), obj);
  }
}

export class AccountDecryptionOptions {
  hasMasterPassword: boolean;
  trustedDeviceOption?: TrustedDeviceUserDecryptionOption;
  keyConnectorOption?: KeyConnectorUserDecryptionOption;

  constructor(init?: Partial<AccountDecryptionOptions>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  // TODO: these nice getters don't work because the Account object is not properly being deserialized out of
  // JSON (the Account static fromJSON method is not running) so these getters don't exist on the
  // account decryptions options object when pulled out of state.  This is a bug that needs to be fixed later on
  // get hasTrustedDeviceOption(): boolean {
  //   return this.trustedDeviceOption !== null && this.trustedDeviceOption !== undefined;
  // }

  // get hasKeyConnectorOption(): boolean {
  //   return this.keyConnectorOption !== null && this.keyConnectorOption !== undefined;
  // }

  static fromResponse(response: IdentityTokenResponse): AccountDecryptionOptions {
    if (response == null) {
      return null;
    }

    const accountDecryptionOptions = new AccountDecryptionOptions();

    if (response.userDecryptionOptions) {
      // If the response has userDecryptionOptions, this means it's on a post-TDE server version and can interrogate
      // the new decryption options.
      const responseOptions = response.userDecryptionOptions;
      accountDecryptionOptions.hasMasterPassword = responseOptions.hasMasterPassword;

      if (responseOptions.trustedDeviceOption) {
        accountDecryptionOptions.trustedDeviceOption = new TrustedDeviceUserDecryptionOption(
          responseOptions.trustedDeviceOption.hasAdminApproval,
          responseOptions.trustedDeviceOption.hasLoginApprovingDevice,
          responseOptions.trustedDeviceOption.hasManageResetPasswordPermission,
        );
      }

      if (responseOptions.keyConnectorOption) {
        accountDecryptionOptions.keyConnectorOption = new KeyConnectorUserDecryptionOption(
          responseOptions.keyConnectorOption.keyConnectorUrl,
        );
      }
    } else {
      // If the response does not have userDecryptionOptions, this means it's on a pre-TDE server version and so
      // we must base our decryption options on the presence of the keyConnectorUrl.
      // Note that the presence of keyConnectorUrl implies that the user does not have a master password, as in pre-TDE
      // server versions, a master password short-circuited the addition of the keyConnectorUrl to the response.
      // TODO: remove this check after 2023.10 release (https://bitwarden.atlassian.net/browse/PM-3537)
      const usingKeyConnector = response.keyConnectorUrl != null;
      accountDecryptionOptions.hasMasterPassword = !usingKeyConnector;
      if (usingKeyConnector) {
        accountDecryptionOptions.keyConnectorOption = new KeyConnectorUserDecryptionOption(
          response.keyConnectorUrl,
        );
      }
    }
    return accountDecryptionOptions;
  }

  static fromJSON(obj: Jsonify<AccountDecryptionOptions>): AccountDecryptionOptions {
    if (obj == null) {
      return null;
    }

    const accountDecryptionOptions = Object.assign(new AccountDecryptionOptions(), obj);

    if (obj.trustedDeviceOption) {
      accountDecryptionOptions.trustedDeviceOption = new TrustedDeviceUserDecryptionOption(
        obj.trustedDeviceOption.hasAdminApproval,
        obj.trustedDeviceOption.hasLoginApprovingDevice,
        obj.trustedDeviceOption.hasManageResetPasswordPermission,
      );
    }

    if (obj.keyConnectorOption) {
      accountDecryptionOptions.keyConnectorOption = new KeyConnectorUserDecryptionOption(
        obj.keyConnectorOption.keyConnectorUrl,
      );
    }

    return accountDecryptionOptions;
  }
}

export class Account {
  data?: AccountData = new AccountData();
  keys?: AccountKeys = new AccountKeys();
  profile?: AccountProfile = new AccountProfile();
  settings?: AccountSettings = new AccountSettings();
  tokens?: AccountTokens = new AccountTokens();
  decryptionOptions?: AccountDecryptionOptions = new AccountDecryptionOptions();
  adminAuthRequest?: Jsonify<AdminAuthRequestStorable> = null;

  constructor(init: Partial<Account>) {
    Object.assign(this, {
      data: {
        ...new AccountData(),
        ...init?.data,
      },
      keys: {
        ...new AccountKeys(),
        ...init?.keys,
      },
      profile: {
        ...new AccountProfile(),
        ...init?.profile,
      },
      settings: {
        ...new AccountSettings(),
        ...init?.settings,
      },
      tokens: {
        ...new AccountTokens(),
        ...init?.tokens,
      },
      decryptionOptions: {
        ...new AccountDecryptionOptions(),
        ...init?.decryptionOptions,
      },
      adminAuthRequest: init?.adminAuthRequest,
    });
  }

  static fromJSON(json: Jsonify<Account>): Account {
    if (json == null) {
      return null;
    }

    return Object.assign(new Account({}), json, {
      keys: AccountKeys.fromJSON(json?.keys),
      data: AccountData.fromJSON(json?.data),
      profile: AccountProfile.fromJSON(json?.profile),
      settings: AccountSettings.fromJSON(json?.settings),
      tokens: AccountTokens.fromJSON(json?.tokens),
      decryptionOptions: AccountDecryptionOptions.fromJSON(json?.decryptionOptions),
      adminAuthRequest: AdminAuthRequestStorable.fromJSON(json?.adminAuthRequest),
    });
  }
}
