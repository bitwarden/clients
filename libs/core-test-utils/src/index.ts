import { Observable } from "rxjs";

/**
 * Tracks all emissions of a given observable and returns them as an array.
 *
 * Typically used for testing: Call before actions that trigger observable emissions,
 * then assert that expected values have been emitted.
 * @param observable The observable to track.
 * @returns An array of all emitted values.
 */
export function trackEmissions<T>(observable: Observable<T>): T[] {
  const emissions: T[] = [];
  observable.subscribe((value) => {
    switch (value) {
      case undefined:
      case null:
        emissions.push(value);
        return;
      default:
        break;
    }
    switch (typeof value) {
      case "string":
      case "number":
      case "boolean":
        emissions.push(value);
        break;
      case "symbol":
        // Symbols are converted to strings for storage
        emissions.push(value.toString() as T);
        break;
      default:
        emissions.push(clone(value));
    }
  });
  return emissions;
}

function clone(value: any): any {
  if (global.structuredClone !== undefined) {
    return structuredClone(value);
  } else {
    return JSON.parse(JSON.stringify(value));
  }
}

/**
 * Waits asynchronously for a given number of milliseconds.
 *
 * If ms < 1, yields to the event loop immediately.
 * Useful in tests to await the next tick or introduce artificial delays.
 * @param ms Milliseconds to wait (default: 1)
 */
export async function awaitAsync(ms = 1) {
  if (ms < 1) {
    await Promise.resolve();
  } else {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
