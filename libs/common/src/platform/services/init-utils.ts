/**
 * Performs topological sort on services based on their declared dependencies.
 * Returns services in an order where all dependencies come before dependents.
 *
 * @param services The resolved service instances
 * @param tokens The tokens used to register these services (parallel array)
 * @param getDependencies Function to extract dependency tokens from a service instance
 * @throws Error if circular dependencies are detected
 * @throws Error if a dependency is declared but not registered
 */
export function topologicalSort<T, TDep = unknown>(
  services: T[],
  tokens: TDep[],
  getDependencies: (service: T) => TDep[] | undefined,
): T[] {
  // Build a map from token to instance
  const instanceMap = new Map<TDep, T>();
  for (let i = 0; i < services.length; i++) {
    instanceMap.set(tokens[i], services[i]);
  }

  const sorted: T[] = [];
  const visiting = new Set<T>();
  const visited = new Set<T>();

  const visit = (service: T, path: string[] = []) => {
    if (visited.has(service)) {
      return;
    }

    if (visiting.has(service)) {
      const serviceName = (service as any).constructor?.name || "Unknown";
      const cycle = [...path, serviceName].join(" -> ");
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    visiting.add(service);
    const serviceName = (service as any).constructor?.name || "Unknown";
    const currentPath = [...path, serviceName];

    // Visit all dependencies first
    for (const depClass of getDependencies(service) ?? []) {
      const depInstance = instanceMap.get(depClass as TDep);

      if (!depInstance) {
        const depName = (depClass as any).name || "Unknown";
        throw new Error(
          `${serviceName} depends on ${depName}, but ${depName} is not registered. ` +
            `Make sure to register it in your initialization service tokens:\n` +
            `Angular: { provide: INIT_SERVICES, useValue: ${depName}, multi: true }\n` +
            `Background: Add ${depName} to initServiceTokens array and register with injector`,
        );
      }

      visit(depInstance, currentPath);
    }

    visiting.delete(service);
    visited.add(service);
    sorted.push(service);
  };

  // Visit all services (handles disconnected components in the graph)
  for (const service of services) {
    visit(service);
  }

  return sorted;
}
