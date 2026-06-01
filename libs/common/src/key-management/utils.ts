import { firstValueFrom, Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { UserId as SdkUserId } from "@bitwarden/sdk-internal";

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

export function fromSdkUserId(userId: SdkUserId): UserId {
  return userId as unknown as UserId;
}

export function fromTsUserId(userId: UserId): SdkUserId {
  return userId as unknown as SdkUserId;
}
