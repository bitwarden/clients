import { firstValueFrom, switchMap } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { AutomationCapability } from "../automation-capability";

/**
 * The SDK's debug tree (`client.debug()`). Only `@bitwarden/sdk-internal` builds with the dev-only
 * `debug-capabilities` feature (`build.sh -d`) carry it, so it is fully typed when linked against
 * such a build and `unknown` otherwise.
 */
export type SdkDebugClient = PasswordManagerClient extends { debug(): infer D } ? D : unknown;

/**
 * Dev-only access to the SDK's debug tree, which reaches past the public API into internal SDK
 * state. Adds no per-function surface of its own: it resolves the per-user client and hands its
 * debug tree to a callback, so new SDK debug capabilities are callable with no change here.
 */
export class SdkDebugCapability extends AutomationCapability {
  readonly automationName = "sdkDebug";

  constructor(private sdkService: SdkService) {
    super();
  }

  /**
   * Run `fn` against `userId`'s SDK debug tree and resolve with its result.
   *
   * The client is only guaranteed alive while `fn` runs. Do not keep the debug tree, or any
   * handle reached through it, after `fn` returns.
   *
   * @throws when the SDK was built without the `debug-capabilities` feature.
   *
   * @example
   * await driver.get("sdkDebug").forUser(userId, (d) => d.state().types());
   */
  forUser<T>(userId: UserId, fn: (debug: SdkDebugClient) => T | Promise<T>): Promise<T> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (rc) => {
          using ref = rc.take();
          const client = ref.value as { debug?: () => SdkDebugClient };
          if (typeof client.debug !== "function") {
            throw new Error(
              "This SDK build has no debug capabilities. Build sdk-internal with `build.sh -d`.",
            );
          }
          return await fn(client.debug());
        }),
      ),
    );
  }
}
