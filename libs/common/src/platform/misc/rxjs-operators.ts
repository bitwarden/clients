import { map } from "rxjs";

/**
 * An rxjs operator that extracts an object by ID from an array of objects.
 * @param id The ID of the object to return.
 * @returns The first object with a matching ID, or undefined if no matching object is present.
 */
export const getById = <TId, T extends { id: TId }>(id: TId) =>
  map<T[], T | undefined>((objects) => objects.find((o) => o.id === id));

/**
 * An rxjs operator that extracts a subset of objects by their IDs from an array of objects.
 * @param id The IDs of the objects to return.
 * @returns An array containing objects with matching IDs, or an empty array if there are no matching objects.
 */
export const getByIds = <TId, T extends { id: TId }>(ids: TId[]) => {
  const idSet = new Set(ids);
  return map<T[], T[]>((objects) => {
    return objects.filter((o) => o.id && idSet.has(o.id));
  });
};

/**
 * A type guard that returns true if the value is not nullish.
 * Used for filtering nullish values from observable streams.
 * @example someObservable$.pipe(filter(isNotNullish));
 */
export const isNotNullish = <T>(val: T | null | undefined): val is T => val != null;
