import { EnvAccessTokenLocation, accessTokenLocation, cleanUserAgent } from "./utils";

const expectedUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

describe("cleanUserAgent", () => {
  it("cleans mac agent", () => {
    const initialMacAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 11_6_0) AppleWebKit/537.36 (KHTML, like Gecko) Bitwarden/${process.version} Chrome/${process.versions.chrome} Electron/${process.versions.electron} Safari/537.36`;
    expect(cleanUserAgent(initialMacAgent)).toEqual(expectedUserAgent);
  });

  it("cleans windows agent", () => {
    const initialWindowsAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Bitwarden/${process.version} Chrome/${process.versions.chrome} Electron/${process.versions.electron} Safari/537.36`;
    expect(cleanUserAgent(initialWindowsAgent)).toEqual(expectedUserAgent);
  });

  it("cleans linux agent", () => {
    const initialWindowsAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Bitwarden/${process.version} Chrome/${process.versions.chrome} Electron/${process.versions.electron} Safari/537.36`;
    expect(cleanUserAgent(initialWindowsAgent)).toEqual(expectedUserAgent);
  });

  it("does not change version numbers", () => {
    const expected = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36`;
    const initialAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Bitwarden/1.28.3 Chrome/87.0.4280.141 Electron/11.4.5 Safari/537.36`;

    expect(cleanUserAgent(initialAgent)).toEqual(expected);
  });
});

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
