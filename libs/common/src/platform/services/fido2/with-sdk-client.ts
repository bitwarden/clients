import { firstValueFrom, switchMap } from "rxjs";

import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";
import { SdkService } from "../../abstractions/sdk/sdk.service";

/**
 * Runs `operation` against the user's SDK client, holding a reference for exactly as long as the
 * operation runs.
 *
 * @throws if the user has no SDK client.
 */
export async function withSdkClient<T>(
  sdkService: SdkService,
  userId: UserId,
  operation: (client: PasswordManagerClient) => Promise<T>,
): Promise<T> {
  return await firstValueFrom(
    sdkService.userClient$(userId).pipe(
      switchMap(async (sdk) => {
        if (!sdk) {
          throw new Error("The SDK client is unavailable.");
        }
        using ref = sdk.take();
        return await operation(ref.value);
      }),
    ),
  );
}
