import { Page } from "@playwright/test";

/** `T`'s methods, each forwarded to the renderer and resolving to its serialized result. */
export type RemoteCapability<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

/**
 * Proxies one capability of the renderer's automation driver (libs/automation-driver), typed by
 * `T`, the capability's shape as seen from the test.
 *
 * ```ts
 * const lock = automationDriver<{ lock(): Promise<void> }>(page, "lock");
 * await lock.lock();
 * ```
 */
export function automationDriver<T>(page: Page, capability: string): RemoteCapability<T> {
  return new Proxy({} as RemoteCapability<T>, {
    get: (_, method) => {
      // Not a thenable: `await` probes `then`, which must not reach the renderer.
      if (typeof method !== "string" || method === "then") {
        return undefined;
      }

      return (...args: unknown[]) =>
        page.evaluate(
          ([name, fn, fnArgs]) =>
            (window as any).bitwardenAutomationDriver.get(name)[fn](...fnArgs),
          [capability, method, args] as const,
        );
    },
  });
}
