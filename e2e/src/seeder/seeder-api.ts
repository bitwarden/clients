import { APIRequestContext, APIResponse, request } from "@playwright/test";

import { seederAccount } from "../credentials";

/** Header the server tags created entities with, so `DELETE /seed/{playId}` can remove them. */
export const PLAY_ID_HEADER = "x-play-id";

/**
 * Body of a seed response, see `SceneResponseModel` in the server's
 * util/SeederApi/Models/Response/SeedResponseModel.cs.
 */
export type SeedResponse<TResult> = {
  /** Each requested magic string, e.g. an email, to what the server actually stored. */
  mangleMap: Record<string, string | null>;
  result: TResult;
};

/**
 * The SeederApi, called from the test runner rather than the page: it needs no proxy in
 * the web build, and its basic-auth account never reaches the browser.
 */
export class SeederApi {
  private constructor(
    private readonly api: APIRequestContext,
    readonly url: string,
  ) {}

  static async connect(): Promise<SeederApi> {
    const { url, username, password } = seederAccount();
    // A trailing slash, so relative paths resolve under the URL's own path.
    const baseURL = `${url.replace(/\/$/, "")}/`;
    const api = await request.newContext({
      // Explicit, or the config's web vault URL would apply.
      baseURL,
      httpCredentials: { username, password, send: "always" },
    });

    return new SeederApi(api, baseURL);
  }

  /** Runs a scene template, tagging everything it creates with the play id. */
  async seed<TArgs, TResult>(
    playId: string,
    template: string,
    args: TArgs,
  ): Promise<SeedResponse<TResult>> {
    const response = await this.send(() =>
      this.api.post("seed", {
        data: { template, arguments: args },
        headers: { [PLAY_ID_HEADER]: playId },
      }),
    );

    return response.json();
  }

  /** Runs a read-only query template. */
  async query<TArgs, TResult>(template: string, args: TArgs): Promise<TResult> {
    const response = await this.send(() =>
      this.api.post("query", { data: { template, arguments: args } }),
    );

    return response.json();
  }

  /** Deletes everything tagged with the play id, seeded or created through the client. */
  async destroy(playId: string): Promise<void> {
    await this.send(() => this.api.delete(this.playPath(playId)));
  }

  /** The curl command that deletes a play's data by hand, for runs that keep it. */
  destroyCommand(playId: string): string {
    return `curl -u <seeder account> -X DELETE ${new URL(this.playPath(playId), this.url)}`;
  }

  async dispose(): Promise<void> {
    await this.api.dispose();
  }

  private playPath(playId: string): string {
    return `seed/${encodeURIComponent(playId)}`;
  }

  private async send(call: () => Promise<APIResponse>): Promise<APIResponse> {
    let response: APIResponse;
    try {
      response = await call();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not reach the SeederApi at ${this.url}. Is it running?\n${detail}`);
    }

    if (!response.ok()) {
      // The SeederApi answers a failed scene with `{ error, details }`, which names the cause.
      throw new Error(`${response.url()} failed: ${response.status()} ${await response.text()}`);
    }

    return response;
  }
}
