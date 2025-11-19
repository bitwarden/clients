import { init_sdk, LogLevel } from "@bitwarden/sdk-internal";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in docs
import type { SdkService } from "./sdk.service";

export class SdkLoadFailedError extends Error {
  constructor(error: unknown) {
    super(`SDK loading failed: ${error}`);
  }
}

export abstract class SdkLoadService {
  private static markAsReady: () => void;
  private static markAsFailed: (error: unknown) => void;

  /**
   * This promise is resolved when the SDK is ready to be used. Use it when your code might run early and/or is not able to use DI.
   * Beware that WASM always requires a load step which makes it tricky to use functions and classes directly, it is therefore recommended
   * to use the SDK through the {@link SdkService}. Only use this promise in advanced scenarios!
   *
   * @example
   * ```typescript
   * import { pureFunction } from "@bitwarden/sdk-internal";
   *
   * async function myFunction() {
   *   await SdkLoadService.Ready;
   *   pureFunction();
   * }
   * ```
   */
  static readonly Ready = new Promise<void>((resolve, reject) => {
    SdkLoadService.markAsReady = resolve;
    SdkLoadService.markAsFailed = (error: unknown) => reject(new SdkLoadFailedError(error));
  });

  /**
   * Helper to run a function after the SDK is ready.
   * @param fn The function to run after the SDK is ready.
   * @returns The result of the function.
   */
  static readonly WithSdk = <T>(fn: () => T | Promise<T>): Promise<T> => {
    return SdkLoadService.Ready.then(() => fn());
  };

  /**
   * Load WASM and initalize SDK-JS integrations such as logging.
   * This method should be called once at the start of the application.
   * Raw functions and classes from the SDK can be used after this method resolves.
   */
  async loadAndInit(): Promise<void> {
    try {
      await this.load();
      init_sdk(LogLevel.Debug);
      SdkLoadService.markAsReady();
    } catch (error) {
      SdkLoadService.markAsFailed(error);
    }
  }

  protected abstract load(): Promise<void>;
}
