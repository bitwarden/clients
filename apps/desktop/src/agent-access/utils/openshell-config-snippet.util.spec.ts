import { buildOpenShellSnippet } from "./openshell-config-snippet.util";

describe("buildOpenShellSnippet (§M8.8)", () => {
  it("produces exactly the contract gateway.toml", () => {
    const snippet = buildOpenShellSnippet({
      aacPath: "/Applications/Bitwarden.app/Contents/MacOS/aac",
      gatewayName: "openshell",
      driverSocketPath: "/Users/me/.bitwarden-openshell-driver.sock",
    });
    expect(snippet?.gatewayToml).toBe(
      [
        "[openshell.gateway]",
        'credential_drivers = ["bitwarden"]',
        "",
        "[openshell.credential_drivers.bitwarden]",
        'transport = "uds"',
        'socket_path = "/Users/me/.bitwarden-openshell-driver.sock"',
        'command = "/Applications/Bitwarden.app/Contents/MacOS/aac"',
        'args = ["openshell-driver", "--gateway", "openshell"]',
        "startup_timeout_secs = 10",
      ].join("\n"),
    );
    expect(snippet?.gatewayName).toBe("openshell");
    expect(snippet?.providerExample).toBe(
      "openshell provider create --name <provider>-<sandbox> --type <profile> --credential GITHUB_TOKEN=bw://item/<item-uuid>#password",
    );
    expect(snippet?.attachExample).toBe(
      "openshell sandbox provider attach <sandbox> <provider>-<sandbox>",
    );
  });

  it('escapes \\ and " as TOML basic strings', () => {
    const snippet = buildOpenShellSnippet({
      aacPath: 'C:\\odd "path"\\aac',
      gatewayName: "gw",
      driverSocketPath: '/tmp/a"b\\c.sock',
    });
    expect(snippet?.gatewayToml).toContain('command = "C:\\\\odd \\"path\\"\\\\aac"');
    expect(snippet?.gatewayToml).toContain('socket_path = "/tmp/a\\"b\\\\c.sock"');
  });

  it.each([
    ["aacPath", { aacPath: "/bin/aac\n[evil]", gatewayName: "gw", driverSocketPath: "/s" }],
    ["gatewayName", { aacPath: "/bin/aac", gatewayName: "gw\u0000", driverSocketPath: "/s" }],
    ["driverSocketPath", { aacPath: "/bin/aac", gatewayName: "gw", driverSocketPath: "/s\u0085" }],
  ])("returns null on a control character in %s", (_field, input) => {
    expect(buildOpenShellSnippet(input)).toBeNull();
  });
});
