/**
 * Returns the difference between two sets.
 * @param a First set
 * @param b Second set
 * @returns A tuple containing two sets:
 * - The first set contains elements unique to `a`.
 * - The second set contains elements unique to `b`.
 * - If an element is present in both sets, it will not be included in either set.
 */
export function difference<T>(a: Set<T>, b: Set<T>): [Set<T>, Set<T>] {
  const intersection = new Set<T>([...a].filter((x) => b.has(x)));
  a = new Set<T>([...a].filter((x) => !intersection.has(x)));
  b = new Set<T>([...b].filter((x) => !intersection.has(x)));

  return [a, b];
}
