/**
 * Performs deep equality check between two values
 *
 * NOTE: This method uses JSON.stringify to compare objects, which may return false
 * for objects with the same properties but in different order. If order-insensitive
 * comparison becomes necessary in future, consider updating this method to use a comparison
 * that checks for property existence and value equality without regard to order.
 */
export function compareValues<T>(value1: T, value2: T): boolean {
  if (value1 == null && value2 == null) {
    return true;
  }

  if (value1 && value2 == null) {
    return false;
  }

  if (value1 == null && value2) {
    return false;
  }

  if (typeof value1 !== "object" || typeof value2 !== "object") {
    return value1 === value2;
  }

  return JSON.stringify(value1) === JSON.stringify(value2);
}
