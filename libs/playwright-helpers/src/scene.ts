import { SceneTemplate } from "./scene-templates/scene-template";

/**
 * A Scene contains logic to set up and tear down data for a test on the server.
 * It is created by providing a Scene Template, which contains the arguments the server requires to create the data.
 *
 * Scenes are intended to be initialized through the {@link Play.scene} method.
 */
export class Scene<UpParams = unknown, Returns = void> {
  private inited = false;
  private _template?: SceneTemplate<UpParams, Returns>;
  private mangledMap = new Map<string, string | null>();
  private _returnValue?: Returns;

  constructor() {}

  private get template(): SceneTemplate<UpParams, Returns> {
    if (!this.inited) {
      throw new Error("Scene must be initialized before accessing template");
    }
    if (!this._template) {
      throw new Error("Scene was not properly initialized");
    }
    return this._template;
  }

  /** The template arguments used to initialize this scene */
  get upArgs(): UpParams {
    return this.template.upArgs;
  }

  /** The value returned from the seeder API for this scene */
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

  async init(template: SceneTemplate<UpParams, Returns>): Promise<void> {
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
