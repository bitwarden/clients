import { Query } from "./queries/query";
import {
  SceneOptions,
  Scene,
  SCENE_OPTIONS_DEFAULTS,
  seedIdsToTearDown,
  seedIdsToWarnAbout,
} from "./scene";
import { SceneTemplate } from "./scene-templates/scene-template";

export class Play {
  /**
   * Runs server-side code to create a test scene and automatically destroys the scene when disposed.
   *
   * Scenes also expose a `mangle` method that can be used to mangle magic string in the same way the server reports them
   * back to avoid collisions. For example, if a scene creates a user with the email `test@example.com`, you can call
   * `scene.mangle("test@example.com")` to get the actual email address of the user created in the scene.
   *
   * Example usage:
   * ```ts
   * import { Play, SingleUserScene } from "@bitwarden/playwright-helpers";
   *
   * test("my test", async ({ page }) => {
   *  using scene = await Play.scene(new SingleUserScene({ email: "
   *  expect(scene.mangle("my-id")).not.toBe("my-id");
   * });
   *
   * @param template The template to run to create the scene
   * @param options Options for the scene
   * @returns
   */
  static async scene<TUp, TResult>(
    template: SceneTemplate<TUp, TResult>,
    options: SceneOptions = {},
  ): Promise<Scene<TResult>> {
    const opts = { ...SCENE_OPTIONS_DEFAULTS, ...options };
    if (opts.noDown && process.env.CI) {
      throw new Error("Cannot set noDown to true in CI environments");
    }
    const scene = new Scene<TResult>(opts);
    await scene.init(template);
    if (!opts.noDown) {
      seedIdsToTearDown.add(scene.seedId);
    } else {
      seedIdsToWarnAbout.add(scene.seedId);
    }
    return scene;
  }

  static async DeleteAllScenes(): Promise<void> {
    await Scene.DeleteAllScenes();
  }

  static async query<TUp, TReturns>(template: Query<TUp, TReturns>): Promise<TReturns> {
    return await template.fetch();
  }
}
