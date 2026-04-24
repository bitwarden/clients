import { firstValueFrom, map, Observable } from "rxjs";
import { SdkService } from "../platform/abstractions/sdk/sdk.service";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";
import { RegisterSdkService } from "../platform/abstractions/sdk/register-sdk.service";

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

export async function withPasswordManagerSdk<TResult>(
  userId: UserId,
  sdkService: SdkService,
  registerSdkService: RegisterSdkService,
  fn: (sdk: PasswordManagerClient) => TResult
): Promise<TResult> {
  try {
    return await firstValueFrom(
      sdkService.userClient$(userId).pipe(
        map((sdk) => {
          using ref = sdk.take();
          return fn(ref.value);
        })
      )
    );
  } catch (error) {
    return firstValueFrom(
      registerSdkService.registerClient$(userId).pipe(
        map((client) => {
          using ref = client.take();
          return fn(ref.value);
        })
      )
    );
  }
}