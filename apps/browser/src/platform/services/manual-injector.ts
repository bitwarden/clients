import { Dependency, Injector } from "@bitwarden/common/platform/abstractions/injector";

/**
 * Map-based manual dependency injector.
 * Services are explicitly registered in a Map before use.
 * No reflection or property name conventions required.
 */
export class ManualInjector<TDep extends Dependency = Dependency> implements Injector {
  private readonly serviceMap = new Map<Dependency, unknown>();

  /**
   * Register a service instance with its token.
   */
  register(token: TDep, instance: unknown): void {
    if (this.serviceMap.has(token)) {
      throw new Error(`Service ${token.name} is already registered`);
    }
    this.serviceMap.set(token, instance);
  }

  /**
   * Returns all tokens that have been registered with this injector.
   */
  getRegisteredTokens(): TDep[] {
    return Array.from(this.serviceMap.keys()) as TDep[];
  }

  get<T>(token: Dependency): T {
    const service = this.serviceMap.get(token);

    if (!service) {
      throw new Error(
        `Cannot resolve ${token.name}: Not registered. ` +
          `Call register(${token.name}, <instance>) before calling get().`,
      );
    }

    return service as T;
  }
}
