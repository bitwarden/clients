import { firstValueFrom, map, Observable } from "rxjs";

import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { assertNonNullish } from "../../auth/utils";
import { EncryptedString, EncString } from "../crypto/models/enc-string";

import { PinLockType } from "./pin-lock-type";
import { PinStateServiceAbstraction } from "./pin-state.service.abstraction";
import {
  PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  USER_KEY_ENCRYPTED_PIN,
  PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT,
} from "./pin.state";

export class PinStateService implements PinStateServiceAbstraction {
  constructor(private stateProvider: StateProvider) {}

  userKeyWrappedPin$(userId: UserId): Observable<EncString | null> {
    assertNonNullish(userId, "userId");

    return this.stateProvider
      .getUserState$(USER_KEY_ENCRYPTED_PIN, userId)
      .pipe(map((value) => (value ? new EncString(value) : null)));
  }

  async getPinLockType(userId: UserId): Promise<PinLockType> {
    assertNonNullish(userId, "userId");

    const isPersistentPinSet =
      (await this.getPinProtectedUserKeyEnvelope(userId, "PERSISTENT")) != null ||
      // Deprecated
      (await this.getLegacyPinKeyEncryptedUserKeyPersistent(userId)) != null;
    const isPinSet =
      (await firstValueFrom(this.stateProvider.getUserState$(USER_KEY_ENCRYPTED_PIN, userId))) !=
      null;

    if (isPersistentPinSet) {
      return "PERSISTENT";
    } else if (isPinSet) {
      return "EPHEMERAL";
    } else {
      return "DISABLED";
    }
  }

  async getPinProtectedUserKeyEnvelope(
    userId: UserId,
    pinLockType: PinLockType,
  ): Promise<PasswordProtectedKeyEnvelope | null> {
    assertNonNullish(userId, "userId");

    if (pinLockType === "EPHEMERAL") {
      return await firstValueFrom(
        this.stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, userId),
      );
    } else if (pinLockType === "PERSISTENT") {
      return await firstValueFrom(
        this.stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, userId),
      );
    } else {
      throw new Error(`Unsupported PinLockType: ${pinLockType}`);
    }
  }

  async getLegacyPinKeyEncryptedUserKeyPersistent(userId: UserId): Promise<EncString | null> {
    assertNonNullish(userId, "userId");

    return await firstValueFrom(
      this.stateProvider
        .getUserState$(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, userId)
        .pipe(map((value) => (value ? new EncString(value) : null))),
    );
  }

  async setPinState(
    userId: UserId,
    pinProtectedUserKeyEnvelope: PasswordProtectedKeyEnvelope,
    userKeyEncryptedPin: EncryptedString,
    pinLockType: PinLockType,
  ): Promise<void> {
    assertNonNullish(userId, "userId");
    assertNonNullish(pinProtectedUserKeyEnvelope, "pinProtectedUserKeyEnvelope");
    assertNonNullish(pinLockType, "pinLockType");

    let keyDefinition;
    if (pinLockType === "EPHEMERAL") {
      keyDefinition = PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL;
    } else if (pinLockType === "PERSISTENT") {
      keyDefinition = PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT;
    } else {
      throw new Error(`Cannot set up PIN with pin lock type ${pinLockType}`);
    }

    await this.stateProvider.setUserState(keyDefinition, pinProtectedUserKeyEnvelope, userId);

    await this.stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, userKeyEncryptedPin, userId);
  }

  async clearPinState(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");

    await this.stateProvider.setUserState(USER_KEY_ENCRYPTED_PIN, null, userId);
    await this.stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, null, userId);
    await this.stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, null, userId);

    // Note: This can be deleted after sufficiently many PINs are migrated and the state is removed.
    await this.stateProvider.setUserState(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, null, userId);
  }

  async clearEphemeralPinState(userId: UserId): Promise<void> {
    assertNonNullish(userId, "userId");

    await this.stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, null, userId);
  }
}
