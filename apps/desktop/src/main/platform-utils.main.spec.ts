import { EnvAccessTokenLocation, accessTokenLocation, isSnapStore } from "./platform-utils.main";

describe("accessTokenLocation", () => {
  const original = process.env.ACCESS_TOKEN_LOCATION;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ACCESS_TOKEN_LOCATION;
    } else {
      process.env.ACCESS_TOKEN_LOCATION = original;
    }
  });

  it("defaults to Keyring when unset", () => {
    delete process.env.ACCESS_TOKEN_LOCATION;
    expect(accessTokenLocation()).toEqual(EnvAccessTokenLocation.Default);
  });

  it("returns Disk for DISK", () => {
    process.env.ACCESS_TOKEN_LOCATION = "DISK";
    expect(accessTokenLocation()).toEqual(EnvAccessTokenLocation.Disk);
  });

  it("parses case-insensitively", () => {
    process.env.ACCESS_TOKEN_LOCATION = "disk";
    expect(accessTokenLocation()).toEqual(EnvAccessTokenLocation.Disk);
  });

  it("returns Keyring for DEFAULT", () => {
    process.env.ACCESS_TOKEN_LOCATION = "DEFAULT";
    expect(accessTokenLocation()).toEqual(EnvAccessTokenLocation.Default);
  });

  it("falls back to Keyring for unrecognized values", () => {
    process.env.ACCESS_TOKEN_LOCATION = "somewhere-else";
    expect(accessTokenLocation()).toEqual(EnvAccessTokenLocation.Default);
  });
});

describe("isSnapStore", () => {
  const originalPlatform = process.platform;
  const originalSnap = process.env.SNAP;
  const originalSnapName = process.env.SNAP_NAME;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  const restoreEnv = (key: "SNAP" | "SNAP_NAME", value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    restoreEnv("SNAP", originalSnap);
    restoreEnv("SNAP_NAME", originalSnapName);
  });

  it("returns true for the stable snap on Linux", () => {
    setPlatform("linux");
    process.env.SNAP = "/snap/bitwarden/x1";
    process.env.SNAP_NAME = "bitwarden";
    expect(isSnapStore()).toBe(true);
  });

  it("returns true for the beta snap on Linux", () => {
    setPlatform("linux");
    process.env.SNAP = "/snap/bitwarden-beta/x1";
    process.env.SNAP_NAME = "bitwarden-beta";
    expect(isSnapStore()).toBe(true);
  });

  it("returns false when SNAP_NAME belongs to another snap (leaked env)", () => {
    setPlatform("linux");
    process.env.SNAP = "/snap/some-terminal/x1";
    process.env.SNAP_NAME = "some-terminal";
    expect(isSnapStore()).toBe(false);
  });

  it("returns false when SNAP is unset", () => {
    setPlatform("linux");
    delete process.env.SNAP;
    process.env.SNAP_NAME = "bitwarden";
    expect(isSnapStore()).toBe(false);
  });

  it("returns false on non-Linux platforms", () => {
    setPlatform("darwin");
    process.env.SNAP = "/snap/bitwarden/x1";
    process.env.SNAP_NAME = "bitwarden";
    expect(isSnapStore()).toBe(false);
  });
});
