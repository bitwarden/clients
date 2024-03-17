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
export function record<T, TKey extends string = string>(
  valueDeserializer: (value: Jsonify<T>) => T,
): (record: Jsonify<Record<TKey, T>>) => Record<TKey, T> {
  return (jsonValue: Jsonify<Record<TKey, T> | null>) => {
    if (jsonValue == null) {
      return null;
    }

    const output: Record<string, T> = {};
    for (const key in jsonValue) {
      output[key] = valueDeserializer((jsonValue as Record<string, Jsonify<T>>)[key]);
    }
    return output;
  };
}
