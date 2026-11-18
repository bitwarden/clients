/**
 * Names a read-only server-side query and its arguments. Each subclass matches an `IQuery`
 * in the server's util/Seeder/Queries, by class name. Queries read what the test cannot
 * observe through a client, such as the links in an invite email.
 */
export abstract class QueryTemplate<TArgs, TResult> {
  abstract readonly template: string;

  /** Never read; it carries `TResult` so `Play.query` can infer the query's result type. */
  protected readonly resultType?: TResult;

  constructor(readonly args: TArgs) {}
}
