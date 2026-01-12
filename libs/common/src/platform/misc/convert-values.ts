// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ObservableInput, OperatorFunction, map } from "rxjs";

/**
 * Converts a record of keys and values into a record preserving the original key and converting each value into an {@link ObservableInput}.
 * @param project A function to project a given key and value pair into an {@link ObservableInput}
 */
export function convertValues<TKey extends PropertyKey, TInput, TOutput>(
  project: (key: TKey, value: TInput) => ObservableInput<TOutput>,
): OperatorFunction<Record<TKey, TInput> | null, Record<TKey, ObservableInput<TOutput>>> {
  return map((inputRecord) => {
    if (inputRecord == null) {
      return null;
    }

    // Can't use TKey in here, have to use `PropertyKey`
    const result: Record<PropertyKey, ObservableInput<TOutput>> = {};
    for (const [key, value] of Object.entries(inputRecord) as [TKey, TInput][]) {
      result[key] = project(key, value);
    }

    return result;
  });
}
