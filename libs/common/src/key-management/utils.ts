import { firstValueFrom, map, Observable } from "rxjs";

import { PasswordManagerClient, UserId as SdkUserId } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { assertNonNullish } from "../auth/utils";
import { SdkService } from "../platform/abstractions/sdk/sdk.service";

import { EncString } from "./crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "./master-password/abstractions/master-password.service.abstraction";

export async function firstValueFromOrThrow<T>(
  value: Observable<T | null>,
  name: string,
): Promise<T> {
  const result = await firstValueFrom(value);
  if (result == null) {
    throw new Error(`Failed to get ${name}`);
  }
  return result;
}

/**
 * A helper function to run code on a PasswordManagerClient. This will get the
 * locked or unlocked PasswordManagerClient depending on whether the user is currently locked or not.
 * This should be (later) handled within the SDK service instead.
 *
 * @param passedInFunction - A function is passed in. The function takes a password manager client and returns a result. The function is run as part of running withPasswordManagerSdk
 *   in order to uphold the lifetime rules of the SDK client.
 */
export async function withPasswordManagerSdk<TResult>(
  userId: UserId,
  sdkService: SdkService,
  passedInFunction: (sdk: PasswordManagerClient) => Promise<TResult>,
): Promise<TResult> {
  return await firstValueFrom(
    sdkService.userClient$(userId).pipe(
      map(async (sdk) => {
        using ref = sdk.take();
        return await passedInFunction(ref.value);
      }),
    ),
  );
}

/**
 * Keeps the legacy locally-cached master key and master-key-wrapped user key in sync with the
 * persisted master-password unlock data, so that master-key based unlock verification etc. keeps
 * working after the SDK re-derives them (e.g. on a KDF change). The SDK has already written the new
 * unlock data to state, so we read it back to derive the master key.
 *
 * TODO: Drop this helper and all of its callers once key connector runs via the SDK, at which point
 * ownership of this state moves into the SDK and it no longer needs to be mirrored client-side.
 */
export async function syncLegacyMasterKeyState(
  userId: UserId,
  masterPassword: string,
  masterPasswordService: InternalMasterPasswordServiceAbstraction,
): Promise<void> {
  const unlockData = await firstValueFrom(masterPasswordService.masterPasswordUnlockData$(userId));
  assertNonNullish(unlockData, "unlockData");
  await masterPasswordService.setLegacyMasterKeyFromUnlockData(masterPassword, unlockData, userId);
  await masterPasswordService.setMasterKeyEncryptedUserKey(
    new EncString(unlockData.masterKeyWrappedUserKey),
    userId,
  );
}

/**
 * Method decorator that asserts the named positional arguments are non-nullish
 * before the method body runs. Otherwise throws.
 *
 * @example
 * ```ts
 *   @assertParametersNonNull()
 *   async setPin(pin: string, pinLockType: PinLockType, userId: UserId): Promise<void> {
 *     // ...
 *   }
 * ```
 */
export function assertParametersNonNull(): MethodDecorator {
  return (_target, _propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = function (this: unknown, ...args: unknown[]) {
      for (let i = 0; i < args.length; i++) {
        assertNonNullish(args[i], `parameter ${i}`);
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}

export function fromSdkUserId(userId: SdkUserId): UserId {
  return userId as unknown as UserId;
}

export function fromTsUserId(userId: UserId): SdkUserId {
  return userId as unknown as SdkUserId;
}
