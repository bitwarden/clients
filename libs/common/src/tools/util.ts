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

/** Type guard that returns `true` when the value is an i18n key.  */
export function isI18nKey(value: I18nKeyOrLiteral): value is string {
  return typeof value === "string";
}

/** Type guard that returns `true` when the value requires no translation.
 *  @remarks the literal value can be accessed using the `.literal` property.
 */
export function isLiteral(value: I18nKeyOrLiteral): value is { literal: string } {
  return typeof value === "object" && "literal" in value;
}
