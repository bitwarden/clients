import { devFlagEnabled, DevFlags } from "../flags";

export function devFlag(flag: keyof DevFlags) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (!devFlagEnabled(flag)) {
        throw new Error(
          `This method should not be called, it is protected by a disabled dev flag.`,
        );
      }
      return originalMethod.apply(this, args);
    };
  };
}
