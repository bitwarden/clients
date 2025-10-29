import { webServerBaseUrl } from "@playwright-config";

// First seed points at the seeder API proxy, second is the seed path of the SeedController
const seedApiUrl = new URL("/seed/seed/", webServerBaseUrl).toString();

export abstract class SceneTemplate<TUp, TReturns = void> {
  abstract template: string;
  private seedId?: string;

  get currentSeedId(): string {
    if (!this.seedId) {
      throw new Error("Scene has not been seeded yet");
    }
    return this.seedId;
  }

  constructor(private upArgs: TUp) {}
  async up(): Promise<SceneTemplateResult<TReturns>> {
    const result = await sceneUp<TUp, TReturns>(this.template, this.upArgs);
    this.seedId = result.seedId;
    return {
      mangleMap: result.mangleMap,
      result: result.result,
    };
  }

  async down(): Promise<void> {
    if (!this.seedId) {
      return;
    }

    await sceneDown(this.seedId);
    this.seedId = undefined;
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

async function sceneDown(seedId: string): Promise<void> {
  const url = new URL(`${seedId}`, seedApiUrl).toString();
  const response = await fetch(url, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete scene: ${response.statusText}`);
  }
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
