// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as papa from "papaparse";

/**
 * Returns an array of unique items from a collection based on a specified key.
 *
 * @param {T[]} items The array of items to process.
 * @param {(item: T) => K} keySelector A function that selects the key to identify uniqueness.
 * @returns {T[]} An array of unique items.
 */
export function getUniqueItems<T, K>(items: T[], keySelector: (item: T) => K): T[] {
  const uniqueKeys = new Set<K>();
  const uniqueItems: T[] = [];

  items.forEach((item) => {
    const key = keySelector(item);
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      uniqueItems.push(item);
    }
  });

  return uniqueItems;
}
/**
 * Sums all the values of a specified numeric property in an array of objects.
 *
 * @param {T[]} array - The array of objects containing the property to be summed.
 * @param {(item: T) => number} getProperty - A function that returns the numeric property value for each object.
 * @returns {number} - The total sum of the specified property values.
 */
export function sumValue<T>(values: T[], getProperty: (item: T) => number): number {
  return values.reduce((sum, item) => sum + getProperty(item), 0);
}

/**
 * Collects a specified property from an array of objects.
 *
 * @param array The array of objects to collect from.
 * @param property The property to collect.
 * @returns An array of aggregated values from the specified property.
 */
export function collectProperty<T, K extends keyof T, V>(array: T[], property: K): V[] {
  const collected: V[] = array
    .map((i) => i[property])
    .filter((value) => Array.isArray(value))
    .flat() as V[];

  return collected;
}

/**
 * Exports an array of objects to a CSV string.
 *
 * @param {T[]} data - An array of objects to be exported.
 * @param {[key in keyof T]: string } headers - A mapping of keys of type T to their corresponding header names.
 * @returns A string in csv format from the input data.
 */
export function exportToCSV<T>(data: T[], headers?: Partial<{ [key in keyof T]: string }>): string {
  const mappedData = data.map((item) => {
    const mappedItem: { [key: string]: string } = {};
    for (const key in item) {
      if (headers != null && headers[key as keyof T]) {
        mappedItem[headers[key as keyof T]] = String(item[key as keyof T]);
      } else {
        mappedItem[key] = String(item[key as keyof T]);
      }
    }
    return mappedItem;
  });
  return papa.unparse(mappedData);
}
