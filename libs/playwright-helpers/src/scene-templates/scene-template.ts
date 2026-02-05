import { webServerBaseUrl } from "@playwright-config";

// First seed points at the seeder API proxy, second is the seed path of the SeedController
const seedApiUrl = new URL("/seed/seed/", webServerBaseUrl).toString();

export type extractTUpType<T> = T extends SceneTemplate<infer U, any> ? U : never;

/**
 * A SceneTemplate represents a predefined set of data and state to be created on the server for testing purposes.
 * It contains the arguments required by the server to create the data.
 *
 * SceneTemplates are intended to be used to create {@link Scene} instances through the {@link Play.scene} method.
 */
export abstract class SceneTemplate<TUp, TReturns = void> {
  abstract template: string;

  constructor(public upArgs: TUp) {}
  async up(): Promise<SceneTemplateResult<TReturns>> {
    const result = await sceneUp<TUp, TReturns>(this.template, this.upArgs);
    return {
      mangleMap: result.mangleMap,
      result: result.result,
    };
  }
}

async function sceneUp<TUp, TReturns>(
  template: string,
  args: TUp,
): Promise<SeederApiResult<TReturns>> {
  const response = await fetch(seedApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template: template,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to seed scene: ${response.statusText}`);
  }

  return (await response.json()) as SeederApiResult<TReturns>;
}

export interface SeederApiResult<TReturns> {
  mangleMap: Record<string, string | null>;
  result: TReturns;
  seedId: string;
}

export interface SceneTemplateResult<TReturns> {
  mangleMap: Record<string, string | null>;
  result: TReturns;
}
