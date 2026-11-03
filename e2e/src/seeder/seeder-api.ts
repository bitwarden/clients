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
 * Runs a scene template, tagging everything it creates with the play id.
 *
 * Calls the SeederApi from the test runner, not the page: it needs no proxy in the
 * web build, and its basic-auth account never reaches the browser.
 */
export async function seed<TArgs, TResult>(
  playId: string,
  template: string,
  args: TArgs,
): Promise<SeedResponse<TResult>> {
  const response = await send("POST", "seed", { template, arguments: args }, playId);
  return response.json();
}

/** Runs a read-only query template. */
export async function query<TArgs, TResult>(template: string, args: TArgs): Promise<TResult> {
  const response = await send("POST", "query", { template, arguments: args });
  return response.json();
}

/** Deletes everything tagged with the play id, seeded or created through the client. */
export async function destroy(playId: string): Promise<void> {
  await send("DELETE", `seed/${encodeURIComponent(playId)}`);
}

/** The curl command that deletes a play's data by hand, for runs that keep it. */
export function destroyCommand(playId: string): string {
  return `curl -u <seeder account> -X DELETE ${seederUrl(`seed/${encodeURIComponent(playId)}`)}`;
}

function seederUrl(path: string): string {
  return new URL(path, `${seederAccount().url.replace(/\/$/, "")}/`).toString();
}

async function send(
  method: "POST" | "DELETE",
  path: string,
  body?: unknown,
  playId?: string,
): Promise<Response> {
  const { username, password } = seederAccount();
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (playId !== undefined) {
    headers[PLAY_ID_HEADER] = playId;
  }

  const url = seederUrl(path);
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    // The SeederApi answers a failed scene with `{ error, details }`, which names the cause.
    throw new Error(`${method} ${url} failed: ${response.status} ${await response.text()}`);
  }

  return response;
}
