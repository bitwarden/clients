/** Recursively freeze an object's own keys
 *  @param value the value to freeze
 *  @returns `value`
 *  @remarks this function is derived from MDN's `deepFreeze`, which
 *   has been committed to the public domain.
 */
export function deepFreeze<T extends object>(value: T): Readonly<T> {
  const keys = Reflect.ownKeys(value) as (keyof T)[];

  for (const key of keys) {
    const own = value[key];

    if ((own && typeof own === "object") || typeof own === "function") {
      deepFreeze(own);
    }
  }

  return Object.freeze(value);
}
