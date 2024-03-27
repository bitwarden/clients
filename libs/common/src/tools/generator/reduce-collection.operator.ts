import { map, OperatorFunction } from "rxjs";

/**
 * An observable operator that reduces an emitted collection to a single object,
 * returning a default if all items are ignored.
 * @param reduce The reduce function to apply to the filtered collection. The
 *  first argument is the accumulator, and the second is the current item. The
 *  return value is the new accumulator.
 * @param defaultValue The default value to return if the collection is empty. The
 *   default value is also the initial value of the accumulator.
 */
export function reduceCollection<Item, Accumulator>(
  reduce: (acc: Accumulator, value: Item) => Accumulator,
  defaultValue: Accumulator,
): OperatorFunction<Item[], Accumulator> {
  return map((values: Item[]) => {
    const reduced = (values ?? []).reduce(reduce, structuredClone(defaultValue));
    return reduced;
  });
}
