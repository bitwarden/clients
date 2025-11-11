import { SceneTemplate } from "./scene-templates/scene-template";

/**
 * A Scene contains logic to set up and tear down data for a test on the server.
 * It is created by providing a Scene Template, which contains the arguments the server requires to create the data.
 *
 * Scenes are `Disposable`, meaning they must be used with the `using` keyword and will be automatically torn down when disposed.
 * Options exist to modify this behavior.
 *
 * - {@link SceneOptions.noDown}: Useful for setting up data then using codegen to create tests that use the data. Remember to tear down the data manually.
 * - {@link SceneOptions.downAfterAll}: Useful for expensive setups that you want to share across all tests in a worker or for writing acts.
 */
export class Scene<Returns = void> {
  private inited = false;
  private _template?: SceneTemplate<unknown, Returns>;
  private mangledMap = new Map<string, string | null>();
  private _returnValue?: Returns;

  constructor() {}

  private get template(): SceneTemplate<unknown, Returns> {
    if (!this.inited) {
      throw new Error("Scene must be initialized before accessing template");
    }
    if (!this._template) {
      throw new Error("Scene was not properly initialized");
    }
    return this._template;
  }

  get returnValue(): Returns {
    if (!this.inited) {
      throw new Error("Scene must be initialized before accessing returnValue");
    }
    return this._returnValue!;
  }

  mangle(id: string): string {
    if (!this.inited) {
      throw new Error("Scene must be initialized before mangling ids");
    }

    return this.mangledMap.get(id) ?? id;
  }

  async init<T extends SceneTemplate<TUp, Returns>, TUp>(template: T): Promise<void> {
    if (this.inited) {
      throw new Error("Scene has already been initialized");
    }
    this._template = template;
    this.inited = true;

    const result = await template.up();

    this.mangledMap = new Map(Object.entries(result.mangleMap));
    this._returnValue = result.result as unknown as Returns;
  }
}
