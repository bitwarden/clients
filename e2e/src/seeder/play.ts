import { randomUUID } from "node:crypto";

import { QueryTemplate } from "./query";
import { Scene, SceneTemplate } from "./scene";
import { SeederApi } from "./seeder-api";

/** Keeps a run's data on the server, e.g. `E2E_KEEP_SEEDED_DATA=1`, to inspect it afterwards. */
const KEEP_SEEDED_DATA = process.env.E2E_KEEP_SEEDED_DATA != null;

/**
 * One test's server-side data. Everything it seeds, and everything its pages create
 * through the client, is tagged with its id and deleted together by `clean`.
 */
export class Play {
  readonly id = randomUUID();

  /** Same shape as the server's mangle prefix, so local and seeded values read alike. */
  private readonly mangleId = this.id.slice(0, 8);

  constructor(private readonly seeder: SeederApi) {}

  /** Runs a scene template on the server. */
  async scene<TArgs, TResult>(
    template: SceneTemplate<TArgs, TResult>,
  ): Promise<Scene<TArgs, TResult>> {
    const { result, mangleMap } = await this.seeder.seed<TArgs, TResult>(
      this.id,
      template.template,
      template.args,
    );

    return new Scene(template.args, result, mangleMap);
  }

  /** Runs a read-only query template on the server. */
  async query<TArgs, TResult>(template: QueryTemplate<TArgs, TResult>): Promise<TResult> {
    return this.seeder.query<TArgs, TResult>(template.template, template.args);
  }

  /**
   * Makes a value the test creates through the client unique to this play, mangling it
   * the way the server mangles seeded ones. Seed data instead wherever a scene exists.
   */
  mangle(value: string): string {
    return `${this.mangleId}${value.includes("@") ? "+" : "-"}${value}`;
  }

  /** Deletes the play's data, unless the run keeps it. */
  async clean(): Promise<void> {
    if (KEEP_SEEDED_DATA) {
      // eslint-disable-next-line no-console -- the only way to hand the command to the developer
      console.warn(
        `Kept seeded data for play ${this.id}. Delete it with:\n${this.seeder.destroyCommand(this.id)}`,
      );
      return;
    }

    await this.seeder.destroy(this.id);
  }
}
