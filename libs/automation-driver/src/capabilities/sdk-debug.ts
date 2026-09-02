import { firstValueFrom, switchMap } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DebugClient } from "@bitwarden/sdk-internal";

/**
 * Dev-only access to the SDK's hand-rolled debug tree (`client.debug()`), which
 * reaches past the public API into internal client state. Available only on
 * clients backed by the WASM SDK built with the dev-only `debug-capabilities`
 * feature (otherwise `debug()` is absent and calls throw).
 *
 * This capability adds no per-function surface of its own: it resolves the
 * per-user client and hands its debug tree to a callback, so new SDK debug
 * capabilities are callable here with no clients change. The callback runs while
 * an `Rc` reference is held and the client is guaranteed alive; do not stash the
 * `DebugClient` (or any handle reached through it) for use after it returns —
 * the client is freed once the callback completes.
 */
export class SdkDebugCapability {
  constructor(private sdkService: SdkService) {}

  /**
   * Run `fn` against `userId`'s SDK debug tree and resolve with its result.
   *
   * @example
   * await driver.debug.forUser(uid, (d) => d.key_store().list());
   * await driver.debug.forUser(uid, (d) => d.auth().login_method());
   */
  forUser<T>(userId: string, fn: (debug: DebugClient) => T | Promise<T>): Promise<T> {
    return firstValueFrom(
      this.sdkService.userClient$(userId as UserId).pipe(
        switchMap(async (rc) => {
          using ref = rc.take();
          return await fn(ref.value.debug());
        }),
      ),
    );
  }
}
