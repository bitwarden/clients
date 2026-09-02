import { Inject, Injectable } from "@angular/core";

import { AutomationCapability } from "./automation-capability";

/**
 * A small surface attached to the global object for external automation (E2E tests, manual
 * automation). Mirrors {@link ContainerService.attachToGlobal}.
 */
@Injectable()
export class AutomationDriver {
  private readonly capabilities = new Map<string, AutomationCapability>();

  constructor(@Inject(AutomationCapability) capabilities: AutomationCapability[]) {
    for (const capability of capabilities) {
      const name = capability.automationName;

      if (this.capabilities.has(name)) {
        throw new Error(`Duplicate automation capability name: ${name}`);
      }

      this.capabilities.set(name, capability);
    }
  }

  /**
   * Look a capability up by name, or `undefined` when the running client does not provide it.
   *
   * @example
   * const lock = driver.get<LockCapability>("lock");
   */
  get<T extends AutomationCapability>(name: string): T | undefined {
    return this.capabilities.get(name) as T | undefined;
  }

  /** Names of every registered capability, so a caller can discover the surface. */
  list(): string[] {
    return [...this.capabilities.keys()];
  }

  attachToGlobal(global: any) {
    if (!global.bitwardenAutomationDriver) {
      global.bitwardenAutomationDriver = this;
    }
  }
}
