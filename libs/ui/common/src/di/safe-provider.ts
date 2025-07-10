import { Provider } from "@angular/core";
import { Constructor, Opaque } from "type-fest";

import { SafeInjectionToken } from "./safe-injection-token";

/**
 * The return type of the {@link safeProvider} helper function.
 * Used to distinguish a type safe provider definition from a non-type safe provider definition.
 */
export type SafeProvider = Opaque<Provider>;

// TODO: type-fest also provides a type like this when we upgrade >= 3.7.0
type AbstractConstructor<T> = abstract new (...args: any) => T;

type MapParametersToDeps<T> = {
  [K in keyof T]: AbstractConstructor<T[K]> | SafeInjectionToken<T[K]>;
};

type SafeInjectionTokenType<T> = T extends SafeInjectionToken<infer J> ? J : never;

/**
 * Gets the instance type from a constructor, abstract constructor, or SafeInjectionToken
 */
type ProviderInstanceType<T> =
  T extends SafeInjectionToken<any>
    ? InstanceType<SafeInjectionTokenType<T>>
    : T extends Constructor<any> | AbstractConstructor<any>
      ? InstanceType<T>
      : never;

/**
 * Represents a dependency provided with the useClass option.
 */
type SafeClassProvider<
  A extends AbstractConstructor<any> | SafeInjectionToken<any>,
  I extends Constructor<ProviderInstanceType<A>>,
  D extends MapParametersToDeps<ConstructorParameters<I>>,
> = {
  provide: A;
  useClass: I;
  deps: D;
};

/**
 * Represents a dependency provided with the useValue option.
 */
type SafeValueProvider<A extends SafeInjectionToken<any>, V extends SafeInjectionTokenType<A>> = {
  provide: A;
  useValue: V;
};

/**
 * Represents a dependency provided with the useFactory option.
 */
type SafeFactoryProvider<
  A extends AbstractConstructor<any> | SafeInjectionToken<any>,
  I extends (...args: any) => ProviderInstanceType<A>,
  D extends MapParametersToDeps<Parameters<I>>,
> = {
  provide: A;
  useFactory: I;
  deps: D;
  multi?: boolean;
};

/**
 * Represents a dependency provided with the useExisting option.
 */
type SafeExistingProvider<
  A extends Constructor<any> | AbstractConstructor<any> | SafeInjectionToken<any>,
  I extends Constructor<ProviderInstanceType<A>> | AbstractConstructor<ProviderInstanceType<A>>,
> = {
  provide: A;
  useExisting: I;
};

/**
 * Represents a dependency where there is no abstract token, the token is the implementation
 */
type SafeConcreteProvider<
  I extends Constructor<any>,
  D extends MapParametersToDeps<ConstructorParameters<I>>,
> = {
  provide: I;
  deps: D;
};

/**
 * If useAngularDecorators: true is specified, do not require a deps array.
 * This is a manual override for where @Injectable decorators are used
 */
type UseAngularDecorators<T extends { deps: any }> = Omit<T, "deps"> & {
  useAngularDecorators: true;
};

/**
 * Represents a type with a deps array that may optionally be overridden with useAngularDecorators
 */
type AllowAngularDecorators<T extends { deps: any }> = T | UseAngularDecorators<T>;

/**
 * A factory function that creates a provider for the ngModule providers array.
 * This (almost) guarantees type safety for your provider definition. It does nothing at runtime.
 * Warning: the useAngularDecorators option provides an override where your class uses the Injectable decorator,
 * however this cannot be enforced by the type system and will not cause an error if the decorator is not used.
 * @example safeProvider({ provide: MyService, useClass: DefaultMyService, deps: [AnotherService] })
 * @param provider Your provider object in the usual shape (e.g. using useClass, useValue, useFactory, etc.)
 * @returns The exact same object without modification (pass-through).
 */
export const safeProvider = <
  // types for useClass
  AClass extends AbstractConstructor<any> | SafeInjectionToken<any>,
  IClass extends Constructor<ProviderInstanceType<AClass>>,
  DClass extends MapParametersToDeps<ConstructorParameters<IClass>>,
  // types for useValue
  AValue extends SafeInjectionToken<any>,
  VValue extends SafeInjectionTokenType<AValue>,
  // types for useFactory
  AFactory extends AbstractConstructor<any> | SafeInjectionToken<any>,
  IFactory extends (...args: any) => ProviderInstanceType<AFactory>,
  DFactory extends MapParametersToDeps<Parameters<IFactory>>,
  // types for useExisting
  AExisting extends Constructor<any> | AbstractConstructor<any> | SafeInjectionToken<any>,
  IExisting extends
    | Constructor<ProviderInstanceType<AExisting>>
    | AbstractConstructor<ProviderInstanceType<AExisting>>,
  // types for no token
  IConcrete extends Constructor<any>,
  DConcrete extends MapParametersToDeps<ConstructorParameters<IConcrete>>,
>(
  provider:
    | AllowAngularDecorators<SafeClassProvider<AClass, IClass, DClass>>
    | SafeValueProvider<AValue, VValue>
    | AllowAngularDecorators<SafeFactoryProvider<AFactory, IFactory, DFactory>>
    | SafeExistingProvider<AExisting, IExisting>
    | AllowAngularDecorators<SafeConcreteProvider<IConcrete, DConcrete>>
    | Constructor<unknown>,
): SafeProvider => provider as SafeProvider;
