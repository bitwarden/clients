import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

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

  userKeyEncryptedPin$(userId: UserId): Observable<EncString | null> {
    assertNonNullish(userId, "userId");

    return this.stateProvider
      .getUserState$(USER_KEY_ENCRYPTED_PIN, userId)
      .pipe(map((value) => (value ? new EncString(value) : null)));
  }

  pinSet$(userId: UserId): Observable<boolean> {
    assertNonNullish(userId, "userId");
    return this.pinLockType$(userId).pipe(map((pinLockType) => pinLockType !== "DISABLED"));
  }

  async isPinSet(userId: UserId): Promise<boolean> {
    assertNonNullish(userId, "userId");
    return (await this.getPinLockType(userId)) !== "DISABLED";
  }

  pinLockType$(userId: UserId): Observable<PinLockType> {
    assertNonNullish(userId, "userId");

    return combineLatest([
      this.pinProtectedUserKeyEnvelope$(userId, "PERSISTENT").pipe(map((key) => key != null)),
      // Deprecated
      this.legacyPinKeyEncryptedUserKeyPersistent$(userId).pipe(map((key) => key != null)),
      this.stateProvider
        .getUserState$(USER_KEY_ENCRYPTED_PIN, userId)
        .pipe(map((key) => key != null)),
    ]).pipe(
      map(([isPersistentPinSet, isLegacyPersistentPinSet, isPinSet]) => {
        if (isPersistentPinSet || isLegacyPersistentPinSet) {
          return "PERSISTENT";
        } else if (isPinSet) {
          return "EPHEMERAL";
        } else {
          return "DISABLED";
        }
      }),
    );
  }

  async getPinLockType(userId: UserId): Promise<PinLockType> {
    assertNonNullish(userId, "userId");

    return await firstValueFrom(this.pinLockType$(userId));
  }

  async getPinProtectedUserKeyEnvelope(
    userId: UserId,
    pinLockType: PinLockType,
  ): Promise<PasswordProtectedKeyEnvelope | null> {
    assertNonNullish(userId, "userId");

    return await firstValueFrom(this.pinProtectedUserKeyEnvelope$(userId, pinLockType));
  }

  async getLegacyPinKeyEncryptedUserKeyPersistent(userId: UserId): Promise<EncString | null> {
    assertNonNullish(userId, "userId");

    return await firstValueFrom(this.legacyPinKeyEncryptedUserKeyPersistent$(userId));
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

    if (pinLockType === "EPHEMERAL") {
      await this.stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
        pinProtectedUserKeyEnvelope,
        userId,
      );
    } else if (pinLockType === "PERSISTENT") {
      await this.stateProvider.setUserState(
        PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT,
        pinProtectedUserKeyEnvelope,
        userId,
      );
    } else {
      throw new Error(`Cannot set up PIN with pin lock type ${pinLockType}`);
    }

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

  private pinProtectedUserKeyEnvelope$(
    userId: UserId,
    pinLockType: PinLockType,
  ): Observable<PasswordProtectedKeyEnvelope | null> {
    assertNonNullish(userId, "userId");

    if (pinLockType === "EPHEMERAL") {
      return this.stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, userId);
    } else if (pinLockType === "PERSISTENT") {
      return this.stateProvider.getUserState$(PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT, userId);
    } else {
      throw new Error(`Unsupported PinLockType: ${pinLockType}`);
    }
  }

  private legacyPinKeyEncryptedUserKeyPersistent$(userId: UserId): Observable<EncString | null> {
    assertNonNullish(userId, "userId");

    return this.stateProvider
      .getUserState$(PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT, userId)
      .pipe(map((value) => (value ? new EncString(value) : null)));
  }
}
