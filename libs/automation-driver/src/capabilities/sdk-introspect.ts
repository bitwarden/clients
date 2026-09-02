import { firstValueFrom, switchMap } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

/**
 * Crawls the live SDK object graph and reaches hand-rolled debug capabilities
 * (for example the login method) that the SDK's public API does not expose.
 *
 * Everything is path-addressed, mirroring the SDK's `IntrospectClient`: the JS
 * surface is a fixed set of generic verbs, not one method per thing, so it does
 * not grow as the SDK adds capabilities. Available only on clients backed by the
 * WASM SDK, and only when that SDK was built with the dev-only `introspect`
 * feature (otherwise `introspect()` is absent and calls throw).
 *
 * Each verb takes the `userId` whose client to crawl. User state such as the
 * login method lives on the per-user client; the userless client carries none of
 * it, so a user id is required rather than defaulting to the active user.
 */
export class SdkIntrospectCapability {
  constructor(private sdkService: SdkService) {}

  /** Structural crawl: the node at `path` (type, preview, writeability, children), or null. */
  async describe(userId: string, path: string[]): Promise<unknown> {
    const json = await this.withClient(userId, (client) => client.introspect().describe(path));
    return json == null ? null : JSON.parse(json);
  }

  /** Read the value at `path`, resolving async capabilities such as the login method. */
  async read(userId: string, path: string[]): Promise<unknown> {
    const json = await this.withClient(userId, (client) => client.introspect().read(path));
    return json == null ? null : JSON.parse(json);
  }

  /** Write `value` to the node at `path`. Debug-only; bypasses public-API guards. */
  async write(userId: string, path: string[], value: unknown): Promise<void> {
    await this.withClient(userId, (client) =>
      client.introspect().write(path, JSON.stringify(value)),
    );
  }

  /**
   * Resolve the per-user client and run `fn` against it while a reference is
   * held, so the client is not freed mid-call. All work happens inside the
   * observable (the client is destroyed once the subscription ends); only the
   * serialized result of `fn` escapes.
   */
  private withClient<T>(
    userId: string,
    fn: (client: PasswordManagerClient) => T | Promise<T>,
  ): Promise<T> {
    return firstValueFrom(
      this.sdkService.userClient$(userId as UserId).pipe(
        switchMap(async (rc) => {
          using ref = rc.take();
          return await fn(ref.value);
        }),
      ),
    );
  }
}
