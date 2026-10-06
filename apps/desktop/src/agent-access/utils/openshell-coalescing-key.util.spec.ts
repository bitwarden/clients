import { openShellCoalescingKey } from "./openshell-coalescing-key.util";

function message(): Record<string, unknown> {
  return {
    localPeer: {
      exePath: "/opt/homebrew/bin/aac",
      parent: { exePath: "/opt/homebrew/bin/openshell-gateway" },
      signature: { kind: "macosPathOnly", identity: "/opt/homebrew/bin/openshell-gateway" },
    },
    openshell: {
      deadlineMs: 25000,
      gatewayName: "openshell",
      gatewayEndpoint: "https://127.0.0.1:17670",
      providerId: "prov-7f3a",
      providerName: "gh-agent-1",
      providerProfile: "github",
      workspace: "default",
      sandboxId: "sbx-01J9Z6",
      sandboxName: "agent-1",
      sandboxImage: "ghcr.io/example/agent:1.2",
      endpoints: [{ host: "api.github.com", port: 443, path: "/**", source: "profile" }],
      policyDigest: "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
      advisorEnabled: false,
    },
    providerTargets: [
      { credentialKey: "A", resourceType: "credential", id: "id-1", field: "password" },
      { credentialKey: "B", resourceType: "secret", id: "id-2", field: "value" },
    ],
  };
}

describe("openShellCoalescingKey (§M8.18)", () => {
  const base = openShellCoalescingKey("user-1", message());

  it("is stable, ignores target order and the deadline", () => {
    const m = message();
    (m.providerTargets as unknown[]).reverse();
    (m.openshell as Record<string, unknown>).deadlineMs = 9000;
    expect(base).not.toBeNull();
    expect(openShellCoalescingKey("user-1", m)).toBe(base);
  });

  it.each([
    ["account", (m: any) => m, "user-2"],
    ["gateway name", (m: any) => (m.openshell.gatewayName = "other"), "user-1"],
    ["gateway endpoint", (m: any) => (m.openshell.gatewayEndpoint = "https://x"), "user-1"],
    ["sandbox id", (m: any) => (m.openshell.sandboxId = "sbx-2"), "user-1"],
    ["sandbox name", (m: any) => (m.openshell.sandboxName = "agent-2"), "user-1"],
    ["sandbox image", (m: any) => delete m.openshell.sandboxImage, "user-1"],
    ["provider id", (m: any) => (m.openshell.providerId = "prov-2"), "user-1"],
    ["provider name", (m: any) => (m.openshell.providerName = "p2"), "user-1"],
    ["profile", (m: any) => (m.openshell.providerProfile = "p2"), "user-1"],
    ["workspace", (m: any) => (m.openshell.workspace = "w2"), "user-1"],
    [
      "policy digest",
      (m: any) => (m.openshell.policyDigest = "sha256:" + "0".repeat(64)),
      "user-1",
    ],
    ["advisor flag", (m: any) => delete m.openshell.advisorEnabled, "user-1"],
    ["target field", (m: any) => (m.providerTargets[0].field = "username"), "user-1"],
    ["target id", (m: any) => (m.providerTargets[0].id = "id-9"), "user-1"],
    ["target key", (m: any) => (m.providerTargets[0].credentialKey = "Z"), "user-1"],
    ["target set", (m: any) => m.providerTargets.pop(), "user-1"],
    ["gateway identity", (m: any) => (m.localPeer.signature.identity = "/tmp/gw"), "user-1"],
    ["gateway path", (m: any) => (m.localPeer.parent.exePath = "/tmp/gw"), "user-1"],
  ])("changes with the %s", (_label, mutate, userId) => {
    const m = message();
    mutate(m);
    expect(openShellCoalescingKey(userId, m)).not.toBe(base);
  });

  it("is null when the message can't be keyed", () => {
    expect(openShellCoalescingKey("", message())).toBeNull();
    expect(openShellCoalescingKey("user-1", { ...message(), openshell: undefined })).toBeNull();
    expect(openShellCoalescingKey("user-1", { ...message(), providerTargets: [] })).toBeNull();
    expect(openShellCoalescingKey("user-1", { ...message(), localPeer: {} })).toBeNull();
  });
});
