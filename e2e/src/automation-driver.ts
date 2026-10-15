import { Page } from "@playwright/test";

/** Methods a capability exposes, e.g. `{ approve(id?: string): Promise<void> }`. */
type CapabilityMethods<T> = { [K in keyof T]: (...args: any[]) => unknown };

/**
 * Calls one capability of the renderer's automation driver (libs/automation-driver), typed by
 * `T`, the capability's shape as seen from the test.
 *
 * ```ts
 * const lock = new AutomationDriver<{ lock(): Promise<void> }>(page, "lock");
 * await lock.call("lock");
 * ```
 */
export class AutomationDriver<T extends CapabilityMethods<T>> {
  constructor(
    private page: Page,
    private capability: string,
  ) {}

  async call<K extends keyof T & string>(
    method: K,
    ...args: Parameters<T[K]>
  ): Promise<Awaited<ReturnType<T[K]>>> {
    return this.page.evaluate(
      ([name, fn, fnArgs]) => (window as any).bitwardenAutomationDriver.get(name)[fn](...fnArgs),
      [this.capability, method, args] as const,
    );
  }
}
