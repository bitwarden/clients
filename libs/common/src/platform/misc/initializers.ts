import { Constructor } from "type-fest";

export function arrayInitialize<T>(
  initializer: (obj: Partial<T>) => T
): (objArray: Partial<T>[]) => T[] {
  return (objArray: Partial<T>[]) => objArray?.map(initializer);
}

export function recordInitialize<T>(
  initializer: (obj: Partial<T>) => T
): (record: { [key: string]: Partial<T> }) => Record<string, T> {
  return (objRecord: { [key: string]: Partial<T> }) => {
    const record: Record<string, T> = {};
    for (const key in objRecord) {
      record[key] = initializer(objRecord[key]);
    }
    return record;
  };
}

export function noopInitialize<T>(jsonObj: Partial<T>): T {
  return jsonObj as T;
}

export function assignPrototype<T>(constructor: Constructor<T>): (obj: Partial<T>) => T {
  return (obj: Partial<T>) => Object.assign(Object.create(constructor.prototype), obj);
}
