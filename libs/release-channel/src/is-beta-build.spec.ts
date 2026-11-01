import { isBetaBuild } from "./is-beta-build";

describe("isBetaBuild", () => {
  afterEach(() => {
    process.env.FLAGS = JSON.stringify({});
  });

  it("returns true when the build sets prereleaseBuild", () => {
    process.env.FLAGS = JSON.stringify({ prereleaseBuild: true });

    expect(isBetaBuild()).toBe(true);
  });

  it.each([
    ["is off", JSON.stringify({ prereleaseBuild: false })],
    ["is not set", JSON.stringify({})],
  ])("returns false when prereleaseBuild %s", (_, flags) => {
    process.env.FLAGS = flags;

    expect(isBetaBuild()).toBe(false);
  });

  it("returns false when FLAGS is not defined", () => {
    delete process.env.FLAGS;

    expect(isBetaBuild()).toBe(false);
  });
});
