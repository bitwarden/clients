import { Query } from "./queries/query";
import { Scene } from "./scene";
import { SceneTemplate } from "./scene-templates/scene-template";
import { cleanStage, playId } from "./test";

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
   *  const scene = await Play.scene(new SingleUserScene({ email: "
   *  expect(scene.mangle("my-id")).not.toBe("my-id");
   * });
   *
   * @param template The template to run to create the scene
   * @param options Options for the scene
   * @returns
   */
  static async scene<TUp, TResult>(template: SceneTemplate<TUp, TResult>): Promise<Scene<TResult>> {
    const scene = new Scene<TResult>();
    await scene.init(template);
    return scene;
  }

  static async clean(): Promise<void> {
    await cleanStage();
  }

  static async query<TUp, TReturns>(template: Query<TUp, TReturns>): Promise<TReturns> {
    return await template.fetch();
  }

  /**
   * Utility to mangle strings consistently within a play session.
   * The preferred method is to use server-side mangling via Scenes, but this is useful
   * for entities that are created as a part of a test, such as user registration.
   *
   * @param str The string to mangle
   * @returns the mangled string
   */
  static mangler(str: string): string {
    return `${str}_${playId.replaceAll("-", "").slice(0, 8)}`;
  }

  /**
   * Utility to mangle email addresses consistently within a play session.
   * The preferred method is to use server-side mangling via Scenes, but this is useful
   * for entities that are created as a part of a test, such as user registration.
   *
   * @param email The email to mangle
   * @returns the mangled email
   */
  static mangleEmail(email: string): string {
    const [localPart, domain] = email.split("@");
    return `${this.mangler(localPart)}@${domain}`;
  }
}
