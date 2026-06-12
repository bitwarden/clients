import { EnvAccessTokenLocation, accessTokenLocation } from "./platform-utils.main";

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
