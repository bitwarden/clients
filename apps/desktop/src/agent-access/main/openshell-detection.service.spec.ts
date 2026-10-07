import * as childProcess from "child_process";
import * as net from "net";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  isLoopbackEndpoint,
  isSupportedGatewayAuth,
  OpenShellDetectionFs,
  OpenShellDetectionService,
} from "./openshell-detection.service";

jest.mock("child_process");
jest.mock("net");

const HOME = "/home/me";

/** In-memory fs that records every path probed or read. */
class FakeFs implements OpenShellDetectionFs {
  readonly probed: string[] = [];
  readonly read: string[] = [];
  readonly listed: string[] = [];

  constructor(
    private files: Record<string, string> = {},
    private dirs: Record<string, string[]> = {},
  ) {}

  async exists(filePath: string): Promise<boolean> {
    this.probed.push(filePath);
    return filePath in this.files;
  }

  async readSmallFile(filePath: string, maxBytes: number): Promise<string | null> {
    this.read.push(filePath);
    const content = this.files[filePath];
    return content != null && content.length <= maxBytes ? content : null;
  }

  async listSubdirectories(dirPath: string): Promise<string[]> {
    this.listed.push(dirPath);
    return this.dirs[dirPath] ?? [];
  }
}

function service(
  platform: NodeJS.Platform,
  fsAdapter: OpenShellDetectionFs,
  env: NodeJS.ProcessEnv = { PATH: "/usr/bin:/bin" },
) {
  return new OpenShellDetectionService(mock<LogService>(), HOME, env, platform, fsAdapter);
}

function assertNoProcessOrNetwork() {
  for (const module of [childProcess, net]) {
    for (const value of Object.values(module)) {
      if (jest.isMockFunction(value)) {
        expect(value).not.toHaveBeenCalled();
      }
    }
  }
}

function assertNeverTouchedCredentialMaterial(fsAdapter: FakeFs) {
  for (const p of [...fsAdapter.read, ...fsAdapter.probed, ...fsAdapter.listed]) {
    expect(p).not.toMatch(/mtls|edge_token|oidc_token/);
  }
}

describe("OpenShellDetectionService (§M8.8)", () => {
  afterEach(() => {
    assertNoProcessOrNetwork();
  });

  it("returns unsupported on win32 without probing anything", async () => {
    const fsAdapter = new FakeFs();
    const result = await service("win32", fsAdapter).detect();
    expect(result).toEqual({
      present: false,
      platformSupported: false,
      unsupportedReason: "windows",
      gateways: [],
      gatewayConfigPathHint: "",
    });
    expect(fsAdapter.probed).toEqual([]);
    expect(fsAdapter.read).toEqual([]);
    expect(fsAdapter.listed).toEqual([]);
  });

  it("detects a Homebrew install on macOS", async () => {
    const fsAdapter = new FakeFs({
      "/opt/homebrew/bin/openshell": "",
      "/opt/homebrew/bin/openshell-gateway": "",
      "/opt/homebrew/var/openshell/gateway.toml": "",
    });
    const result = await service("darwin", fsAdapter).detect();
    expect(result.present).toBe(true);
    expect(result.platformSupported).toBe(true);
    expect(result.unsupportedReason).toBeUndefined();
    expect(result.cliPath).toBe("/opt/homebrew/bin/openshell");
    expect(result.gatewayBinaryPath).toBe("/opt/homebrew/bin/openshell-gateway");
    expect(result.gatewayConfigPath).toBe("/opt/homebrew/var/openshell/gateway.toml");
    expect(result.gatewayConfigPathHint).toBe("/opt/homebrew/var/openshell/gateway.toml");
    // No systemd probing on macOS.
    expect(fsAdapter.probed.some((p) => p.includes("systemd"))).toBe(false);
  });

  it("detects a CLI in ~/.local/bin on Linux", async () => {
    const fsAdapter = new FakeFs({ [`${HOME}/.local/bin/openshell`]: "" });
    const result = await service("linux", fsAdapter).detect();
    expect(result.present).toBe(true);
    expect(result.cliPath).toBe(`${HOME}/.local/bin/openshell`);
    expect(result.gatewayConfigPathHint).toBe(`${HOME}/.config/openshell/gateway.toml`);
  });

  it("detects a systemd user unit alone", async () => {
    const fsAdapter = new FakeFs({
      [`${HOME}/.config/systemd/user/openshell-gateway.service`]: "",
    });
    const result = await service("linux", fsAdapter).detect();
    expect(result.present).toBe(true);
    expect(result.systemdUnitPath).toBe(`${HOME}/.config/systemd/user/openshell-gateway.service`);
    expect(result.cliPath).toBeUndefined();
  });

  it("detects a gateway config alone, honouring an absolute XDG_CONFIG_HOME", async () => {
    const fsAdapter = new FakeFs({ "/xdg/openshell/gateway.toml": "" });
    const result = await service("linux", fsAdapter, {
      PATH: "/usr/bin",
      XDG_CONFIG_HOME: "/xdg",
    }).detect();
    expect(result.present).toBe(true);
    expect(result.gatewayConfigPath).toBe("/xdg/openshell/gateway.toml");
  });

  it("ignores a relative XDG_CONFIG_HOME and relative PATH entries", async () => {
    const fsAdapter = new FakeFs();
    await service("linux", fsAdapter, { PATH: ".:bin:/usr/bin", XDG_CONFIG_HOME: "rel" }).detect();
    expect(fsAdapter.probed).not.toContain("openshell");
    expect(fsAdapter.probed.some((p) => !p.startsWith("/"))).toBe(false);
    expect(fsAdapter.probed).toContain(`${HOME}/.config/openshell/gateway.toml`);
  });

  it("reports nothing when nothing is installed", async () => {
    const result = await service("linux", new FakeFs()).detect();
    expect(result.present).toBe(false);
    expect(result.platformSupported).toBe(true);
  });

  it("marks a Snap environment unsupported", async () => {
    const fsAdapter = new FakeFs({ "/usr/bin/openshell": "" });
    const result = await service("linux", fsAdapter, {
      PATH: "/usr/bin",
      SNAP: "/snap/bw/1",
    }).detect();
    expect(result.present).toBe(true);
    expect(result.platformSupported).toBe(false);
    expect(result.unsupportedReason).toBe("snap");
  });

  it("marks a Snap-only CLI unsupported", async () => {
    const fsAdapter = new FakeFs({ "/snap/bin/openshell": "" });
    const result = await service("linux", fsAdapter, { PATH: "/snap/bin:/usr/bin" }).detect();
    expect(result.unsupportedReason).toBe("snap");
    expect(result.platformSupported).toBe(false);
  });

  it("marks an AppImage run unsupported", async () => {
    const fsAdapter = new FakeFs({ "/usr/bin/openshell": "" });
    const result = await service("linux", fsAdapter, {
      PATH: "/usr/bin",
      APPIMAGE: "/home/me/Bitwarden.AppImage",
    }).detect();
    expect(result.unsupportedReason).toBe("appImage");
    expect(result.platformSupported).toBe(false);
  });

  it("reads only active_gateway and metadata.json, and marks the active gateway", async () => {
    const config = `${HOME}/.config/openshell`;
    const fsAdapter = new FakeFs(
      {
        "/usr/bin/openshell": "",
        [`${config}/active_gateway`]: "work\n",
        [`${config}/gateways/work/metadata.json`]: JSON.stringify({
          gateway_endpoint: "https://gw.example.com:17670",
          auth_mode: "mtls",
          secret_field: "never-kept",
        }),
        [`${config}/gateways/local/metadata.json`]: JSON.stringify({
          gateway_endpoint: "http://127.0.0.1:17670",
          auth_mode: "plaintext",
        }),
        [`${config}/gateways/cf/metadata.json`]: JSON.stringify({
          gateway_endpoint: "https://gw.example.com",
          auth_mode: "cloudflare_jwt",
        }),
        [`${config}/gateways/work/mtls/tls.key`]: "KEY MATERIAL",
        [`${config}/gateways/work/edge_token`]: "TOKEN",
      },
      { [`${config}/gateways`]: ["work", "local", "cf", "bad name"] },
    );
    const result = await service("linux", fsAdapter).detect();
    expect(result.gateways).toEqual([
      {
        name: "cf",
        endpoint: "https://gw.example.com",
        authMode: "cloudflare_jwt",
        active: false,
        authSupported: false,
      },
      {
        name: "local",
        endpoint: "http://127.0.0.1:17670",
        authMode: "plaintext",
        active: false,
        authSupported: true,
      },
      {
        name: "work",
        endpoint: "https://gw.example.com:17670",
        authMode: "mtls",
        active: true,
        authSupported: true,
      },
    ]);
    expect(fsAdapter.read.sort()).toEqual(
      [
        `${config}/active_gateway`,
        `${config}/gateways/cf/metadata.json`,
        `${config}/gateways/local/metadata.json`,
        `${config}/gateways/work/metadata.json`,
      ].sort(),
    );
    assertNeverTouchedCredentialMaterial(fsAdapter);
    expect(JSON.stringify(result)).not.toContain("never-kept");
  });

  it("treats an unparseable metadata file as unsupported auth", async () => {
    const config = `${HOME}/.config/openshell`;
    const fsAdapter = new FakeFs(
      { [`${config}/gateways/x/metadata.json`]: "{not json" },
      { [`${config}/gateways`]: ["x"] },
    );
    const result = await service("darwin", fsAdapter).detect();
    expect(result.gateways).toEqual([
      { name: "x", endpoint: "", authMode: "", active: false, authSupported: false },
    ]);
  });
});

describe("gateway auth rules", () => {
  it.each([
    ["mtls", "https://gw.example.com", true],
    ["plaintext", "http://127.0.0.1:17670", true],
    ["plaintext", "http://localhost:17670", true],
    ["plaintext", "http://[::1]:17670", true],
    ["plaintext", "http://10.0.0.5:17670", false],
    ["plaintext", "http://127.0.0.1.evil.com", false],
    ["cloudflare_jwt", "https://127.0.0.1", false],
    ["oidc", "https://127.0.0.1", false],
    ["", "https://127.0.0.1", false],
  ])("%s at %s → %s", (authMode, endpoint, expected) => {
    expect(isSupportedGatewayAuth(authMode, endpoint)).toBe(expected);
  });

  it("rejects an unparseable endpoint as non-loopback", () => {
    expect(isLoopbackEndpoint("not a url")).toBe(false);
  });
});
