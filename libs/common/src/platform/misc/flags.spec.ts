import { flagEnabled, devFlagEnabled, devFlagValue } from "./flags";

describe("flagEnabled", () => {
  beforeEach(() => {
    process.env.FLAGS = JSON.stringify({});
  });

  it("returns true by default", () => {
    expect(flagEnabled<any>("nonExistentFlag")).toBe(true);
  });

  it("returns true if enabled", () => {
    process.env.FLAGS = JSON.stringify({
      newFeature: true,
    });

    expect(flagEnabled<any>("newFeature")).toBe(true);
  });

  it("returns false if disabled", () => {
    process.env.FLAGS = JSON.stringify({
      newFeature: false,
    });

    expect(flagEnabled<any>("newFeature")).toBe(false);
  });
});

describe("devFlagEnabled", () => {
  beforeEach(() => {
    process.env.DEV_FLAGS = JSON.stringify({});
  });

  describe("in a development environment", () => {
    beforeEach(() => {
      process.env.ENV = "development";
    });

    it("returns false by default", () => {
      expect(devFlagEnabled<any>("nonExistentFlag")).toBe(false);
    });

    it("returns false if devFlags is not defined", () => {
      delete process.env.DEV_FLAGS;
      expect(devFlagEnabled<any>("nonExistentFlag")).toBe(false);
    });

    it("returns true if enabled", () => {
      process.env.DEV_FLAGS = JSON.stringify({
        devHack: true,
      });

      expect(devFlagEnabled<any>("devHack")).toBe(true);
    });

    it("returns true if truthy", () => {
      process.env.DEV_FLAGS = JSON.stringify({
        devHack: { key: 3 },
      });

      expect(devFlagEnabled<any>("devHack")).toBe(true);
    });

    it("returns false if disabled", () => {
      process.env.DEV_FLAGS = JSON.stringify({
        devHack: false,
      });

      expect(devFlagEnabled<any>("devHack")).toBe(false);
    });
  });

  it("always returns false in prod", () => {
    process.env.ENV = "production";
    process.env.DEV_FLAGS = JSON.stringify({
      devHack: true,
    });

    expect(devFlagEnabled<any>("devHack")).toBe(false);
  });
});

describe("devFlagValue", () => {
  beforeEach(() => {
    process.env.DEV_FLAGS = JSON.stringify({});
    process.env.ENV = "development";
  });

  it("throws if dev flag is disabled", () => {
    process.env.DEV_FLAGS = JSON.stringify({
      devHack: false,
    });

    expect(() => devFlagValue<any>("devHack")).toThrow("it is protected by a disabled dev flag");
  });

  it("returns the dev flag value", () => {
    process.env.DEV_FLAGS = JSON.stringify({
      devHack: "Hello world",
    });

    expect(devFlagValue<any>("devHack")).toBe("Hello world");
  });
});
