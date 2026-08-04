import { filter, firstValueFrom, map, race, timer } from "rxjs";

// There is no way to prevent this restricted import currently. These should be extracted out into a separate package.
// eslint-disable-next-line no-restricted-imports
import {
  USER_DECRYPTION_OPTIONS,
  UserDecryptionOptions,
  WebAuthnPrfUserDecryptionOption,
} from "@bitwarden/auth/common";
// eslint-disable-next-line no-restricted-imports
import { fromSdkKdfConfig, KDF_CONFIG } from "@bitwarden/key-management";
import {
  EncString,
  MasterPasswordUnlockData as SdkMasterPasswordUnlockData,
  PasswordProtectedKeyEnvelope,
  SymmetricKey,
  UnsignedSharedKey,
  V2UpgradeToken,
  WasmStateBridge,
  WebAuthnPrfUnlockData as SdkWebAuthnPrfUnlockData,
  WebAuthnPrfUnlockOption as SdkWebAuthnPrfUnlockOption,
  WrappedAccountCryptographicState,
  Kdf,
} from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { compareValues } from "../platform/misc/compare-values";
import { SymmetricCryptoKey } from "../platform/models/domain/symmetric-crypto-key";
import { USER_KEY } from "../platform/services/key-state/user-key.state";
import { StateProvider, UserKeyDefinition } from "../state-migrations";
import { UserKey } from "../types/key";

import { ACCOUNT_CRYPTOGRAPHIC_STATE } from "./account-cryptography/default-account-cryptographic-state.service";
import { MASTER_PASSWORD_UNLOCK_KEY } from "./master-password/services/master-password.service";
import { MasterPasswordUnlockData } from "./master-password/types/master-password.types";
import {
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
  USER_KEY_ENCRYPTED_PIN,
} from "./pin/pin.state";
import { V2_UPGRADE_TOKEN } from "./upgrade-token/v2-upgrade-token.state";

// Helper functions to work around unreliable state. KM state values correctness over speed
// and eventual consistency is not acceptable.

async function readAtomic<T>(
  stateProvider: StateProvider,
  userId: UserId,
  keyDefinition: UserKeyDefinition<T>,
): Promise<T | null> {
  return await firstValueFrom(stateProvider.getUserState$(keyDefinition, userId));
}

async function waitForStateValue<T>(
  stateProvider: StateProvider,
  userId: UserId,
  keyDefinition: UserKeyDefinition<T>,
  expectedValue: T | null,
): Promise<T | null> {
  return firstValueFrom(
    race(
      stateProvider
        .getUserState$(keyDefinition, userId)
        .pipe(filter((value) => compareValues(value, expectedValue))),
      timer(1000).pipe(map((): T | null => null)),
    ),
  );
}

async function writeAtomic<T>(
  stateProvider: StateProvider,
  userId: UserId,
  keyDefinition: UserKeyDefinition<T>,
  value: T,
): Promise<void> {
  await stateProvider.setUserState(keyDefinition, value, userId);
  await waitForStateValue(stateProvider, userId, keyDefinition, value);
}

async function deleteAtomic<T>(
  stateProvider: StateProvider,
  userId: UserId,
  keyDefinition: UserKeyDefinition<T>,
): Promise<void> {
  await stateProvider.setUserState(keyDefinition, undefined, userId);
  await waitForStateValue(stateProvider, userId, keyDefinition, undefined);
}

function toWebAuthnPrfUserDecryptionOption(
  option: SdkWebAuthnPrfUnlockOption,
): WebAuthnPrfUserDecryptionOption {
  const decryptionOption = new WebAuthnPrfUserDecryptionOption();
  decryptionOption.encryptedPrivateKey = option.encryptedPrivateKey;
  decryptionOption.encryptedUserKey = option.encryptedUserKey;
  decryptionOption.credentialId = option.credentialId as string;
  decryptionOption.transports = option.transports ?? [];
  return decryptionOption;
}

function toSdkWebAuthnPrfUnlockOption(
  option: WebAuthnPrfUserDecryptionOption,
): SdkWebAuthnPrfUnlockOption {
  return {
    encryptedPrivateKey: option.encryptedPrivateKey as EncString,
    encryptedUserKey: option.encryptedUserKey as UnsignedSharedKey,
    credentialId: option.credentialId,
    transports: option.transports,
  };
}

export class JsWasmStateBridge implements WasmStateBridge {
  constructor(
    private stateProvider: StateProvider,
    private userId: UserId,
  ) {}

  async set_v2_upgrade_token(value: V2UpgradeToken): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, V2_UPGRADE_TOKEN, value);
  }

  async get_v2_upgrade_token(): Promise<V2UpgradeToken | null> {
    return await readAtomic(this.stateProvider, this.userId, V2_UPGRADE_TOKEN);
  }

  async clear_v2_upgrade_token(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, V2_UPGRADE_TOKEN);
  }

  async set_account_cryptographic_state(value: WrappedAccountCryptographicState): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, ACCOUNT_CRYPTOGRAPHIC_STATE, value);
  }

  async get_account_cryptographic_state(): Promise<WrappedAccountCryptographicState | null> {
    return await readAtomic(this.stateProvider, this.userId, ACCOUNT_CRYPTOGRAPHIC_STATE);
  }

  async clear_account_cryptographic_state(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, ACCOUNT_CRYPTOGRAPHIC_STATE);
  }

  async set_masterpassword_unlock_data(value: SdkMasterPasswordUnlockData): Promise<void> {
    await writeAtomic(
      this.stateProvider,
      this.userId,
      MASTER_PASSWORD_UNLOCK_KEY,
      MasterPasswordUnlockData.fromSdk(value),
    );
  }

  async get_masterpassword_unlock_data(): Promise<SdkMasterPasswordUnlockData | null> {
    const data = await readAtomic(this.stateProvider, this.userId, MASTER_PASSWORD_UNLOCK_KEY);
    return data == null ? null : data.toSdk();
  }

  async clear_masterpassword_unlock_data(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, MASTER_PASSWORD_UNLOCK_KEY);
  }

  async set_webauthn_prf_unlock_data(value: SdkWebAuthnPrfUnlockData): Promise<void> {
    await this.updateWebAuthnPrfOptions(value.options.map(toWebAuthnPrfUserDecryptionOption));
  }

  async get_webauthn_prf_unlock_data(): Promise<SdkWebAuthnPrfUnlockData | null> {
    const options = await readAtomic(this.stateProvider, this.userId, USER_DECRYPTION_OPTIONS);
    if (options?.webAuthnPrfOptions == null) {
      return null;
    }
    return { options: options.webAuthnPrfOptions.map(toSdkWebAuthnPrfUnlockOption) };
  }

  async clear_webauthn_prf_unlock_data(): Promise<void> {
    await this.updateWebAuthnPrfOptions(undefined);
  }

  /**
   * WebAuthn PRF unlock data is one field of the larger user decryption options blob, so it has to
   * be written back without disturbing the sibling options.
   *
   * When no decryption options exist yet there is nothing to merge into: writing a fresh blob would
   * publish defaults (notably `hasMasterPassword: undefined`) that the rest of the client reads as
   * fact, so the write is skipped instead.
   */
  private async updateWebAuthnPrfOptions(
    prfOptions: WebAuthnPrfUserDecryptionOption[] | undefined,
  ): Promise<void> {
    const current = await readAtomic(this.stateProvider, this.userId, USER_DECRYPTION_OPTIONS);
    if (current == null) {
      return;
    }

    const updated = Object.assign(new UserDecryptionOptions(), current);
    updated.webAuthnPrfOptions = prfOptions;

    await writeAtomic(this.stateProvider, this.userId, USER_DECRYPTION_OPTIONS, updated);
  }

  async set_user_key(userKey: SymmetricKey): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, USER_KEY, {
      "": SymmetricCryptoKey.fromSdk(userKey) as UserKey,
    });
  }

  async get_user_key(): Promise<SymmetricKey | null> {
    const key = await readAtomic(this.stateProvider, this.userId, USER_KEY);
    if (key != null) {
      return key[""].toSdk();
    } else {
      return null;
    }
  }

  async clear_user_key(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, USER_KEY);
  }

  async set_ephemeral_pin_envelope(pinEnvelope: PasswordProtectedKeyEnvelope): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, {
      "": { pin_envelope: pinEnvelope },
    });
  }

  async get_ephemeral_pin_envelope(): Promise<PasswordProtectedKeyEnvelope | null> {
    const result = await readAtomic(
      this.stateProvider,
      this.userId,
      PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
    );
    if (result != null) {
      return result[""]?.pin_envelope ?? null;
    } else {
      return null;
    }
  }

  async clear_ephemeral_pin_envelope(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL);
  }

  async set_persistent_pin_envelope(pinEnvelope: PasswordProtectedKeyEnvelope): Promise<void> {
    await writeAtomic(
      this.stateProvider,
      this.userId,
      PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
      pinEnvelope,
    );
  }

  async get_persistent_pin_envelope(): Promise<PasswordProtectedKeyEnvelope | null> {
    return await readAtomic(
      this.stateProvider,
      this.userId,
      PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
    );
  }

  async clear_persistent_pin_envelope(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT);
  }

  async set_encrypted_pin(encryptedPin: EncString): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, USER_KEY_ENCRYPTED_PIN, encryptedPin);
  }

  async get_encrypted_pin(): Promise<EncString | null> {
    return await readAtomic(this.stateProvider, this.userId, USER_KEY_ENCRYPTED_PIN);
  }

  async clear_encrypted_pin(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, USER_KEY_ENCRYPTED_PIN);
  }

  async set_kdf_config(kdfConfig: Kdf): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, KDF_CONFIG, fromSdkKdfConfig(kdfConfig));
  }

  async get_kdf_config(): Promise<Kdf | null> {
    const result = await readAtomic(this.stateProvider, this.userId, KDF_CONFIG);
    return result ? result.toSdkConfig() : null;
  }

  async clear_kdf_config(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, KDF_CONFIG);
  }
}
