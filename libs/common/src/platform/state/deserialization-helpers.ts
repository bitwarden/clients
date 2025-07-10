// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

/**
 *
 * @param elementDeserializer
 * @returns
 */
export function array<T>(
  elementDeserializer: (element: Jsonify<T>) => T,
): (array: Jsonify<T[]>) => T[] {
  return (array) => {
    if (array == null) {
      return null;
    }

    return array.map((element) => elementDeserializer(element));
  };
}

/**
 *
 * @param valueDeserializer
 */
export function record<T, TKey extends string | number = string>(
  valueDeserializer: (value: Jsonify<T>) => T,
): (record: Jsonify<Record<TKey, T>>) => Record<TKey, T> {
  return (jsonValue: Jsonify<Record<TKey, T> | null>) => {
    if (jsonValue == null) {
      return null;
    }

    const output: Record<TKey, T> = {} as any;
    Object.entries(jsonValue).forEach(([key, value]) => {
      output[key as TKey] = valueDeserializer(value);
    });
    return output;
  };
}
