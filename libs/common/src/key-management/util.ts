/**
 * Methods annotated with this decorator will throw if any of the arguments are null or undefined.
 * This is useful when the class uses ts-strict, but the callers do not yet use ts-strict.
 */
export function strictNonNullArgs(target: any, key: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    if (args.some((arg) => arg === null || arg === undefined)) {
      throw new Error(`Method ${key} cannot be called with null or undefined arguments.`);
    }
    return originalMethod.apply(this, args);
  };
}
