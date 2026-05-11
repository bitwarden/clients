import { filter, firstValueFrom, map, race, timer } from "rxjs";

import {
  EncString,
  MasterPasswordUnlockData as SdkMasterPasswordUnlockData,
  PasswordProtectedKeyEnvelope,
  SymmetricKey,
  V2UpgradeToken,
  WasmStateBridge,
  WrappedAccountCryptographicState,
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
import { V2_UPGRADE_TOKEN } from "./v2-upgrade-token.state";

// Helper functions to work around unrealiable state. KM state values correctness over speed
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
}
