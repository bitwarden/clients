import { catchError, firstValueFrom, map, Observable } from "rxjs";

import { PasswordManagerClient } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { RegisterSdkService } from "../platform/abstractions/sdk/register-sdk.service";
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
 */
export async function withPasswordManagerSdk<TResult>(
  userId: UserId,
  sdkService: SdkService,
  registerSdkService: RegisterSdkService,
  fn: (sdk: PasswordManagerClient) => TResult,
): Promise<TResult> {
  try {
    return await firstValueFrom(
      sdkService.userClient$(userId).pipe(
        map((sdk) => {
          using ref = sdk.take();
          return fn(ref.value);
        }),
        catchError(() => {
          throw new Error("SDK client not available");
        }),
      ),
    );
  } catch (error) {
    // If the error is not "SDK client not available", we re-throw it. Otherwise, try on the register client,
    // since the vault appears to be locked.
    if (!(error instanceof Error && error.message === "SDK client not available")) {
      throw error;
    }

    return firstValueFrom(
      registerSdkService.registerClient$(userId).pipe(
        map((client) => {
          using ref = client.take();
          return fn(ref.value);
        }),
      ),
    );
  }
}
