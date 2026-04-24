import { filter, firstValueFrom } from "rxjs";

import {
  EncString,
  PasswordProtectedKeyEnvelope,
  SymmetricKey,
  WasmStateBridge,
} from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { compareValues } from "../platform/misc/compare-values";
import { SymmetricCryptoKey } from "../platform/models/domain/symmetric-crypto-key";
import { USER_KEY } from "../platform/services/key-state/user-key.state";
import { StateProvider, UserKeyDefinition } from "../state-migrations";
import { UserKey } from "../types/key";

import {
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
  USER_KEY_ENCRYPTED_PIN,
} from "./pin/pin.state";

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
    stateProvider
      .getUserState$(keyDefinition, userId)
      .pipe(filter((value) => compareValues(value, expectedValue))),
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

  async set_user_key(userKey: SymmetricKey): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, USER_KEY, SymmetricCryptoKey.fromSdk(userKey) as UserKey);
  }

  async get_user_key(): Promise<SymmetricKey | null> {
    const key = await readAtomic(this.stateProvider, this.userId, USER_KEY);
    if (key != null) {
      return key.toSdk();
    } else {
      return null;
    }
  }

  async clear_user_key(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, USER_KEY);
  }

  async set_ephemeral_pin_envelope(pinEnvelope: PasswordProtectedKeyEnvelope): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, pinEnvelope);
  }

  async get_ephemeral_pin_envelope(): Promise<PasswordProtectedKeyEnvelope | null> {
    return await readAtomic(this.stateProvider, this.userId, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL);
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
    try {
      return await readAtomic(
        this.stateProvider,
        this.userId,
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
      );
    } catch {
      return null;
    }
  }

  async clear_persistent_pin_envelope(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT);
  }

  async set_encrypted_pin(encryptedPin: EncString): Promise<void> {
    await writeAtomic(this.stateProvider, this.userId, USER_KEY_ENCRYPTED_PIN, encryptedPin);
  }

  async get_encrypted_pin(): Promise<EncString | null> {
    return await readAtomic(
      this.stateProvider,
      this.userId,
      USER_KEY_ENCRYPTED_PIN,
    );
  }

  async clear_encrypted_pin(): Promise<void> {
    await deleteAtomic(this.stateProvider, this.userId, USER_KEY_ENCRYPTED_PIN);
  }
}
