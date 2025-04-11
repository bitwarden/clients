import { I18nKeyOrLiteral } from "./types";

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

    if (own && typeof own === "object") {
      deepFreeze(own);
    }
  }

  return Object.freeze(value);
}

export function isI18nKey(value: I18nKeyOrLiteral): value is string {
  return typeof value === "string";
}

export function isLiteral(value: I18nKeyOrLiteral): value is string {
  return typeof value === "object" && "literal" in value;
}
