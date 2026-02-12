import { Dependency, Injector } from "@bitwarden/common/platform/abstractions/injector";

/**
 * Map-based injector for background script.
 * Services are explicitly registered in a Map before use.
 * No reflection or property name conventions required.
 */
export class BackgroundInjector implements Injector {
  private readonly serviceMap = new Map<Dependency, unknown>();

  /**
   * Register a service instance with its token.
   * Call this in MainBackground constructor after service instantiation.
   */
  register(token: Dependency, instance: unknown): void {
    if (this.serviceMap.has(token)) {
      throw new Error(`Service ${token.name} is already registered`);
    }
    this.serviceMap.set(token, instance);
  }

  get<T>(token: Dependency): T {
    const service = this.serviceMap.get(token);

    if (!service) {
      const registered = Array.from(this.serviceMap.keys())
        .map((t) => t.name)
        .join(", ");
      throw new Error(
        `Cannot resolve ${token.name}: Not registered in BackgroundInjector. ` +
          `Registered services: ${registered || "(none)"}. ` +
          `Call injector.register(${token.name}, this.${token.name.charAt(0).toLowerCase() + token.name.slice(1)})`,
      );
    }

    return service as T;
  }
}
