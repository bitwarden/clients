// @ts-strict-ignore
 
import type { Merge } from "type-fest";

/**
 * Lightweight utilities for serialization library.
 */
export class Utils {
  /**
   * Converts a Map into a plain object record.
   */
  static mapToRecord<K extends string | number, V>(map: Map<K, V>): Record<string, V> | null {
    if (map == null) {
      return null;
    }
    if (!(map instanceof Map)) {
      return map as any;
    }
    return Object.fromEntries(map) as Record<string, V>;
  }

  /**
   * Converts a plain object record into a Map.
   */
  static recordToMap<K extends string | number, V>(record: Record<K, V>): Map<K, V> | null {
    if (record == null) {
      return null;
    }
    if (record instanceof Map) {
      return record as Map<K, V>;
    }
    const entries = Object.entries(record) as [string, V][];
    if (entries.length === 0) {
      return new Map();
    }
    // preserve numeric keys
    const firstKey = entries[0][0];
    const isNumeric = !Number.isNaN(Number(firstKey));
    const mapped = entries.map(([k, v]) => [isNumeric ? (Number(k) as any) : (k as any), v]);
    return new Map(mapped) as Map<K, V>;
  }

  /**
   * Applies Object.assign and returns the target.
   */
  static assign<T>(target: T, source: Partial<T>): T {
    return Object.assign(target, source);
  }

  /**
   * Merges two objects with type-fest Merge for typings.
   */
  static merge<Destination, Source>(
    destination: Destination,
    source: Source,
  ): Merge<Destination, Source> {
    return Object.assign(destination, source) as unknown as Merge<Destination, Source>;
  }

  /**
   * Helper to obtain key names in a type-safe way.
   */
  static nameOf<T>(name: string & keyof T): string {
    return name;
  }

  /**
   * Iterates over enum values (non-numeric keys).
   */
  static iterateEnum<O extends object, K extends keyof O = keyof O>(obj: O): O[K][] {
    const keys = Object.keys(obj).filter((k) => Number.isNaN(+k)) as K[];
    return keys.map((k) => obj[k]);
  }
}
