import { Observable, firstValueFrom, isObservable } from "rxjs";

type GenericExecutionContext = Record<string, unknown>;

export class ExecutionContextPropertyBuilder<
  TExecutionContext extends Record<string, unknown>,
  TExecutionContextBuilder extends ExecutionContextBuilder<TExecutionContext>,
  TValue,
> {
  constructor(
    private readonly executionContextBuilder: TExecutionContextBuilder,
    private readonly factory: ExecutionContextFactory<TExecutionContext, TValue>,
  ) {}
  as<const TKey extends string>(
    propertyName: TKey,
  ): ExecutionContextBuilder<TExecutionContext & Record<TKey, TValue>> {
    return this.executionContextBuilder.addPropertyBuilder(propertyName, this.factory);
  }
}

type ExecutionContextFactory<TContext, T> = (context: TContext) => T | Promise<T> | Observable<T>;

export class ExecutionContextBuilder<T extends GenericExecutionContext> {
  // The type of these factories are the context that is built by the time they are called and the value they return,
  // which is protected by the `with` method and `as` method on ExecutionContextPropertyBuilder.
  protected contextMap: { name: string; factory: ExecutionContextFactory<unknown, unknown> }[] = [];

  with<TValue>(
    contextBuilder: ExecutionContextFactory<T, TValue>,
  ): ExecutionContextPropertyBuilder<T, typeof this, TValue> {
    return new ExecutionContextPropertyBuilder(this, contextBuilder);
  }

  withValue<TValue>(
    value: TValue | Promise<TValue>,
  ): ExecutionContextPropertyBuilder<T, typeof this, TValue> {
    return this.with(() => value);
  }

  withFirstValueFrom<TValue>(
    observable: Observable<TValue>,
  ): ExecutionContextPropertyBuilder<T, typeof this, TValue> {
    return this.with(() => observable);
  }

  async build(): Promise<T> {
    const context: Record<string, unknown> = {};
    for (const { name, factory } of this.contextMap) {
      let factoryResult = factory(context);
      if (isObservable(factoryResult)) {
        factoryResult = firstValueFrom(factoryResult);
      }

      context[name] = await factoryResult;
    }
    return context as T;
  }

  /**
   * @internal This method is part of the builder pattern and is not intended for external use.
   *
   * @param propertyName The name of the new context property
   * @param factory The factory that will be used to build the new context property
   * @returns A new ExecutionContextBuilder with the new context property added
   */
  addPropertyBuilder<
    TKey extends string,
    TValue,
    TValueFactory extends ExecutionContextFactory<T, TValue>,
  >(propertyName: TKey, factory: TValueFactory): ExecutionContextBuilder<T & Record<TKey, TValue>> {
    const result = new ExecutionContextBuilder<T & Record<TKey, TValue>>();
    result.contextMap = this.contextMap.concat({ name: propertyName, factory });
    return result;
  }
}
