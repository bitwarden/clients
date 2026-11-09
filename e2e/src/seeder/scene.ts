/**
 * Names a server-side scene and the arguments to run it with. Each subclass matches an
 * `IScene` in the server's util/Seeder/Scenes, by class name.
 */
export abstract class SceneTemplate<TArgs, TResult> {
  abstract readonly template: string;

  /** Never read; it carries `TResult` so `Play.scene` can infer the scene's result type. */
  protected readonly resultType?: TResult;

  constructor(readonly args: TArgs) {}
}

/** Data a scene template created on the server, removed when the test's play is cleaned. */
export class Scene<TArgs, TResult> {
  constructor(
    readonly args: TArgs,
    readonly result: TResult,
    private readonly mangleMap: Record<string, string | null>,
  ) {}

  /**
   * The value the server stored for a magic string in the arguments. The server mangles
   * unique values such as emails, so parallel and repeated runs never collide.
   */
  mangle(value: string): string {
    return this.mangleMap[value] ?? value;
  }
}
