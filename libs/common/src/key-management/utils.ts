import { firstValueFrom, map, Observable } from "rxjs";

import { PasswordManagerClient, UserId as SdkUserId } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { assertNonNullish } from "../auth/utils";
import { SdkService } from "../platform/abstractions/sdk/sdk.service";

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
