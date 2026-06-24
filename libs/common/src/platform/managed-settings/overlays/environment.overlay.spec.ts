import { Region } from "../../abstractions/environment.service";

import { environmentCoerce } from "./environment.overlay";

function getter(map: Record<string, unknown>): (key: string) => string | undefined {
  return (key) => (key in map ? JSON.stringify(map[key]) : undefined);
}

describe("environmentCoerce", () => {
  it("builds a self-hosted EnvironmentState from the managed URL leaves", () => {
    const result = environmentCoerce(
      getter({
        "environment.base": "https://vault.example",
        "environment.api": "https://api.example",
      }),
    );

    expect(result).not.toBeNull();
    expect(result!.region).toBe(Region.SelfHosted);
    expect(result!.urls.base).toBe("https://vault.example");
    expect(result!.urls.api).toBe("https://api.example");
    expect(result!.urls.identity).toBeNull();
  });

  it("returns null when no environment leaf is present", () => {
    expect(environmentCoerce(getter({ "vault.timeout": 900 }))).toBeNull();
  });

  it("accepts a base-only managed environment", () => {
    const result = environmentCoerce(getter({ "environment.base": "https://only-base.example" }));
    expect(result!.urls.base).toBe("https://only-base.example");
    expect(result!.region).toBe(Region.SelfHosted);
  });

  it("treats a malformed leaf as absent rather than throwing", () => {
    expect(environmentCoerce(() => "{not valid json")).toBeNull();
  });

  it("ignores a non-string leaf value", () => {
    expect(environmentCoerce((key) => (key === "environment.base" ? "42" : undefined))).toBeNull();
  });
});
