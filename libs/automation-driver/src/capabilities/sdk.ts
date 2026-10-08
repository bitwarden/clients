import { firstValueFrom, switchMap } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { AutomationCapability } from "../automation-capability";

/**
 * Dev-only access to a user's SDK client, covering its whole public API and, on sdk-internal
 * builds with the `debug-capabilities` feature (`build.sh -d`), its debug tree (`client.debug()`).
 * Adds no per-function surface of its own, so anything the SDK exposes is callable with no change
 * here. Registered only in development builds, since it hands out a user's unlocked client.
 */
export class SdkCapability extends AutomationCapability {
  readonly automationName = "sdk";

  constructor(private sdkService: SdkService) {
    super();
  }

  /**
   * Run `fn` against `userId`'s SDK client and resolve with its result.
   *
   * The client is only guaranteed alive while `fn` runs. Do not keep the client, or any handle
   * reached through it, after `fn` returns.
   *
   * @example
   * await driver.get("sdk").forUser(userId, (client) => client.vault().folders().list());
   * await driver.get("sdk").forUser(userId, (client) => client.debug().state().types());
   */
  forUser<T>(userId: UserId, fn: (client: PasswordManagerClient) => T | Promise<T>): Promise<T> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (rc) => {
          using ref = rc.take();
          return await fn(ref.value);
        }),
      ),
    );
  }
}
