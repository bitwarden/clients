import { recordTrackEntry } from "./track-entry";

/**
 * Method decorator that records each call as a DevTools track entry named after the method.
 * Async methods are measured until their promise settles.
 *
 * @param trackGroup Group the track is nested under, generally the owning team.
 * @param track Track the entry is shown on, generally the class name.
 *
 * @example
 * ```ts
 *   @measured("KeyManagement", "LegacyCrypto")
 *   async makeUserKey(masterKey: MasterKey): Promise<[UserKey, EncString]> {
 *     // ...
 *   }
 * ```
 */
export function measured(trackGroup: string, track: string): MethodDecorator {
  return (_target, propertyKey, descriptor: PropertyDescriptor) => {
    // The key is captured at definition time, so the entry name survives minification
    const name = String(propertyKey);
    const original = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = function (this: unknown, ...args: unknown[]) {
      // Some environments lack the User Timing API, e.g. jsdom; skip recording there
      if (typeof performance?.measure !== "function") {
        return original.apply(this, args);
      }

      const start = performance.now();
      const record = () => recordTrackEntry(name, start, trackGroup, track);

      let result: unknown;
      try {
        result = original.apply(this, args);
      } catch (e) {
        record();
        throw e;
      }

      if (result instanceof Promise) {
        return result.finally(record);
      }

      record();
      return result;
    };

    return descriptor;
  };
}
