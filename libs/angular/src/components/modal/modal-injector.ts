import { InjectOptions, Injector, ProviderToken } from "@angular/core";

export class ModalInjector implements Injector {
  constructor(
    private _parentInjector: Injector,
    private _additionalTokens: WeakMap<any, any>,
  ) {}

  get<T>(
    token: ProviderToken<T>,
    notFoundValue: undefined,
    options: InjectOptions & { optional?: false },
  ): T;
  get<T>(token: ProviderToken<T>, notFoundValue: null, options: InjectOptions): T;
  get<T>(token: ProviderToken<T>, notFoundValue?: T, options?: InjectOptions | null): T;
  get<T>(token: ProviderToken<T>, notFoundValue?: T, flags?: null): T;
  get(token: any, notFoundValue?: any): any;
  get(token: any, notFoundValue?: any, flags?: any): any {
    return this._additionalTokens.get(token) ?? this._parentInjector.get<any>(token, notFoundValue);
  }
}
