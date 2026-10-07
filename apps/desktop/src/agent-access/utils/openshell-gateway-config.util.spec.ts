import { OpenShellSnippetInput } from "./openshell-config-snippet.util";
import {
  isGatewayConfigCurrent,
  mergeGatewayConfig,
  removeFromGatewayConfig,
} from "./openshell-gateway-config.util";

const INPUT: OpenShellSnippetInput = {
  aacPath: "/Applications/Bitwarden.app/Contents/MacOS/aac",
  gatewayName: "openshell",
  driverSocketPath: "/Users/demo/.bitwarden-openshell-driver.sock",
};

const DRIVER_TABLE = [
  "[openshell.credential_drivers.bitwarden]",
  'transport = "uds"',
  'socket_path = "/Users/demo/.bitwarden-openshell-driver.sock"',
  'command = "/Applications/Bitwarden.app/Contents/MacOS/aac"',
  'args = ["openshell-driver", "--gateway", "openshell"]',
  "startup_timeout_secs = 10",
].join("\n");

// The shape of a real gateway.toml: a version, comments, and an unrelated driver table that must
// survive every edit untouched.
const DOCKER_TABLE = [
  "# Docker Desktop has host networking off, so supervisors cannot reach the gateway.",
  "[openshell.drivers.docker]",
  'grpc_endpoint = "https://host.docker.internal:17670"',
].join("\n");

function ok(result: ReturnType<typeof mergeGatewayConfig>) {
  if (result.kind !== "ok") {
    throw new Error(`expected ok, got: ${result.reason}`);
  }
  return result;
}

describe("mergeGatewayConfig", () => {
  it("creates a complete file when there is none", () => {
    const result = ok(mergeGatewayConfig(null, INPUT));

    expect(result.changed).toBe(true);
    expect(result.content).toContain("[openshell.gateway]");
    expect(result.content).toContain('credential_drivers = ["bitwarden"]');
    expect(result.content).toContain(DRIVER_TABLE);
    expect(result.content.endsWith("\n")).toBe(true);
  });

  it("adds both tables to a file that has neither, keeping everything else", () => {
    const existing = `[openshell]\nversion = 2\n\n${DOCKER_TABLE}\n`;

    const result = ok(mergeGatewayConfig(existing, INPUT));

    expect(result.content).toContain("version = 2");
    expect(result.content).toContain(DOCKER_TABLE);
    expect(result.content).toContain(DRIVER_TABLE);
    expect(result.content).toContain('credential_drivers = ["bitwarden"]');
  });

  it("adds the key to an existing [openshell.gateway] without one", () => {
    const existing = `[openshell.gateway]\nbind = "127.0.0.1:17670"\n`;

    const result = ok(mergeGatewayConfig(existing, INPUT));

    expect(result.content).toContain(
      '[openshell.gateway]\ncredential_drivers = ["bitwarden"]\nbind = "127.0.0.1:17670"',
    );
    expect(result.content.match(/\[openshell\.gateway\]/g)).toHaveLength(1);
  });

  it("appends to another driver already listed, keeping it and its comment", () => {
    const existing = `[openshell.gateway]\ncredential_drivers = ["vault"]  # corp\n`;

    const result = ok(mergeGatewayConfig(existing, INPUT));

    expect(result.content).toContain('credential_drivers = ["vault", "bitwarden"]  # corp');
  });

  it("replaces a stale driver table without eating the comment above the next table", () => {
    const existing = [
      "[openshell.gateway]",
      'credential_drivers = ["bitwarden"]',
      "",
      "[openshell.credential_drivers.bitwarden]",
      'transport = "uds"',
      'command = "/old/path/aac"',
      "",
      DOCKER_TABLE,
      "",
    ].join("\n");

    const result = ok(mergeGatewayConfig(existing, INPUT));

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain("/old/path/aac");
    expect(result.content).toContain(DRIVER_TABLE);
    expect(result.content).toContain(DOCKER_TABLE);
  });

  it("is idempotent: merging a merged file changes nothing", () => {
    const first = ok(mergeGatewayConfig(`[openshell]\nversion = 2\n\n${DOCKER_TABLE}\n`, INPUT));

    const second = ok(mergeGatewayConfig(first.content, INPUT));

    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it("normalises CRLF input", () => {
    const result = ok(mergeGatewayConfig("[openshell]\r\nversion = 2\r\n", INPUT));

    expect(result.content).not.toContain("\r");
  });

  it.each([
    ["a multi-line list", '[openshell.gateway]\ncredential_drivers = [\n  "vault",\n]\n'],
    ["a non-string list", "[openshell.gateway]\ncredential_drivers = [1, 2]\n"],
    [
      "a duplicated key",
      '[openshell.gateway]\ncredential_drivers = ["a"]\ncredential_drivers = ["b"]\n',
    ],
    ["dotted keys under [openshell]", '[openshell]\ngateway.credential_drivers = ["a"]\n'],
    [
      "an inline bitwarden driver",
      '[openshell.credential_drivers]\nbitwarden = { transport = "uds" }\n',
    ],
    ["a repeated table", "[openshell.gateway]\nbind = 1\n[openshell.gateway]\nbind = 2\n"],
  ])("refuses rather than guessing for %s", (_name, existing) => {
    expect(mergeGatewayConfig(existing, INPUT).kind).toBe("unmergeable");
  });

  it("refuses an input path with a control character", () => {
    expect(mergeGatewayConfig(null, { ...INPUT, aacPath: "/bad\npath" }).kind).toBe("unmergeable");
  });
});

describe("removeFromGatewayConfig", () => {
  it("undoes a merge, leaving the rest of the file as it was", () => {
    const original = `[openshell]\nversion = 2\n\n${DOCKER_TABLE}\n`;
    const merged = ok(mergeGatewayConfig(original, INPUT));

    const removed = ok(removeFromGatewayConfig(merged.content));

    expect(removed.content).toBe(original);
  });

  it("keeps other credential drivers", () => {
    const existing = `[openshell.gateway]\ncredential_drivers = ["vault"]\n`;
    const merged = ok(mergeGatewayConfig(existing, INPUT));

    const removed = ok(removeFromGatewayConfig(merged.content));

    expect(removed.content).toBe(existing);
  });

  it("changes nothing when the driver was never added", () => {
    const result = ok(removeFromGatewayConfig(`[openshell]\nversion = 2\n`));

    expect(result.changed).toBe(false);
  });
});

describe("isGatewayConfigCurrent", () => {
  it("is true for a merged file and false when the command path has moved", () => {
    const merged = ok(mergeGatewayConfig(null, INPUT)).content;

    expect(isGatewayConfigCurrent(merged, INPUT)).toBe(true);
    expect(isGatewayConfigCurrent(merged, { ...INPUT, aacPath: "/elsewhere/aac" })).toBe(false);
  });

  it("is false for a file without the driver", () => {
    expect(isGatewayConfigCurrent("[openshell]\nversion = 2\n", INPUT)).toBe(false);
  });
});
