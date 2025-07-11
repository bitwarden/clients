import { Simplify, Primitive, ConditionalKeys } from "type-fest";

type Function = (...args: any[]) => any;

/** FIXME: taken from type-fest-v4. remove once we upgrade */
export type RequiredKeysOf<BaseType extends object> = BaseType extends unknown // For distributing `BaseType`
  ? Exclude<keyof BaseType, OptionalKeysOf<BaseType>>
  : never; // Should never happen
export type OptionalKeysOf<BaseType extends object> = BaseType extends unknown // For distributing `BaseType`
  ? keyof {
      [Key in keyof BaseType as BaseType extends Record<Key, BaseType[Key]> ? never : Key]: never;
    } &
      keyof BaseType // Intersect with `keyof BaseType` to ensure result of `OptionalKeysOf<BaseType>` is always assignable to `keyof BaseType`
  : never; // Should never happen

/** END FIXME: taken from type-fest-v4. remove once we upgrade */

// Merges options with defaults, deeply preferring default types over options types.
// FIXME: It's likely the type-fests `MergeDeep` will be a better fit for this, but that is in v4+,
// marked experimental, _and_ caused flaky build failures when testing.
export type OptionsWithDefaultsDeep<Options, Defaults> = Simplify<
  {
    [K in keyof Required<Options> & keyof Defaults]: Defaults[K] extends Primitive | Function
      ? Defaults[K]
      : Defaults[K] extends object
        ? // note: exclude undefined here so that if the type is a union with undefined, we can still get the keys correctly
          OptionsWithDefaultsDeep<Exclude<Options[K], undefined>, Defaults[K]>
        : never; // should only ever be primitive, function, or object
  } & {
    [K in Exclude<keyof Required<Options>, keyof Defaults>]: Options[K];
  }
>;

type DefaultsForDeep<Options extends object> = Simplify<
  // Optional properties part
  Omit<
    Required<{
      [K in keyof Options]: Required<Options>[K] extends Primitive | Function
        ? Options[K]
        : Required<Options>[K] extends object
          ? InternalDefaultsForDeep<Required<Options>[K]>
          : never; // should only ever be primitive, function, or object
    }>,
    RequiredKeysOf<Options>
  > &
    // Manages properties of object type at any level where all properties up the tree are required
    Omit<
      Required<{
        [K in keyof Options]: Required<Options>[K] extends Primitive | Function
          ? Options[K]
          : Required<Options>[K] extends object
            ? DefaultsForDeep<Required<Options>[K]>
            : never; // should only ever be primitive, function, or object
      }>,
      RequiredPrimitiveKeysOf<Options> | RequiredMethodKeysOf<Options>
    >
>;

// Internal helper type to recursively build defaults for nested objects
// This variant does not assume that the Options object defines required properties.
// It is used to build the defaults for nested optional objects in the `DefaultsForDeep` type.
type InternalDefaultsForDeep<Options extends object> = Simplify<
  Required<{
    [K in keyof Options]: Required<Options>[K] extends Primitive | Function
      ? Options[K]
      : Required<Options>[K] extends object
        ? InternalDefaultsForDeep<Required<Options>[K]>
        : never; // should only ever be primitive, function, or object
  }>
>;

// Returns only the keys of `Obj` that are required and not records
type RequiredPrimitiveKeysOf<Obj extends object> = RequiredKeysOf<
  Omit<Obj, ConditionalKeys<Obj, object>>
>;

// Returns only the keys of `Obj` that are required and are functions
type RequiredMethodKeysOf<Obj extends object> = RequiredKeysOf<
  Pick<Obj, ConditionalKeys<Obj, Function>>
>;

type OptionsObjectFilter<T> = object & {
  [K in keyof T]: Required<T[K]> extends Function | Primitive
    ? T[K] // primitives and functions are allowed as-is
    : Required<T>[K] extends object
      ? OptionsObjectFilter<T[K]> // recursively apply to nested objects
      : never; // should only ever be primitive, function, or object
};

/**
 * Merges objects with particular type requirements specific to the case of merging an options object with a defaults object.
 * Properties marked as optional in the options object will be required in the defaults object.
 *
 * Usage here does not, allow the absence of a property in the resolved options to convey meaning. The resolved merged options
 * will always have all properties as required.
 *
 * # Example
 *
 * ```ts
 * import { mergeOptions } from "./options";
 *
 * type ExampleOptions = {
 *   readonly a?: number;
 *   readonly required_func: () => void;
 *   readonly optional_func?: () => void;
 *   readonly b: string;
 *   readonly c?: {
 *     readonly d?: number;
 *     readonly e?: string;
 *   };
 *   readonly f: {
 *     readonly h?: number;
 *     readonly i: string;
 *   };
 * };
 *
 * const EXAMPLE_DEFAULTS = Object.freeze({
 *   a: 0,
 *   optional_func: () => {},
 *   c: {
 *     d: 1,
 *     e: "default"
 *   },
 *   f: {
 *     h: 1,
 *   },
 * });
 *
 * function test() {
 *   const options: ExampleOptions = {
 *     required_func: () => {},
 *     b: "test",
 *     f: {
 *       i: "example",
 *     },
 *   };
 *   expect(mergeOptions<ExampleOptions>(options
 *     ,
 *     EXAMPLE_DEFAULTS,
 *   )).toEqual({
 *     a: 0,
 *     b: "test",
 *     c: {
 *       d: 1,
 *       e: "default",
 *     },
 *     f: {
 *       h: 1,
 *       i: "example",
 *     },
 *     optional_func: EXAMPLE_DEFAULTS.optional_func,
 *     required_func: options.required_func,
 *   });
 * }
 *
 *
 * @param options the options to merge with defaults
 * @param defaults default values for the options object.
 * @returns
 */
export function mergeOptions<
  Options extends object,
  // const Defaults extends DefaultsForDeep<Options>,
>(
  options: OptionsObjectFilter<Options>,
  defaults: DefaultsForDeep<Options>, //Defaults,
): OptionsWithDefaultsDeep<Options, DefaultsForDeep<Options>> {
  const result = { ...options } as any;
  for (const key in defaults) {
    if (result[key] == null) {
      result[key] = (defaults as any)[key];
      continue;
    }
    if (
      typeof result[key] === "object" &&
      typeof (defaults as any)[key] === "object" &&
      !(result[key] instanceof Function)
    ) {
      // recursively merge objects
      result[key] = mergeOptions(
        result[key] as OptionsObjectFilter<Options[keyof Options]>,
        (defaults as any)[key],
      ) as any;
    }
  }
  return result as OptionsWithDefaultsDeep<Options, DefaultsForDeep<Options>>;
}
