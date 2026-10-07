import type { agent_access } from "@bitwarden/desktop-napi";

import {
  deriveAgentAccessAttestationKey,
  deriveAgentAccessDisplayName,
  PATH_SIGNATURE_KIND,
} from "./agent-access-attestation.util";

function makeLocalPeer(
  overrides: Partial<agent_access.LocalPeerInfoData> = {},
): agent_access.LocalPeerInfoData {
  return {
    pid: 4242,
    processName: "aac",
    exePath: "/usr/local/bin/aac",
    ...overrides,
  };
}

describe("deriveAgentAccessAttestationKey", () => {
  it("keys on the code-signature identity when the signature is valid", () => {
    const localPeer = makeLocalPeer({
      signature: { kind: "macosTeamId", identity: "TEAMID:com.anysphere.cursor", valid: true },
    });

    expect(deriveAgentAccessAttestationKey(localPeer)).toEqual({
      signatureKind: "macosTeamId",
      signatureIdentity: "TEAMID:com.anysphere.cursor",
    });
  });

  it("keys on path when the signature is invalid, falling back to the signature's own identity", () => {
    const localPeer = makeLocalPeer({
      exePath: "/Applications/Suspicious.app/Contents/MacOS/Suspicious",
      signature: {
        kind: "macosTeamId",
        identity: "/Applications/Suspicious.app/Contents/MacOS/Suspicious",
        valid: false,
      },
    });

    expect(deriveAgentAccessAttestationKey(localPeer)).toEqual({
      signatureKind: "path",
      signatureIdentity: "/Applications/Suspicious.app/Contents/MacOS/Suspicious",
    });
  });

  it("keys on the attested exe path when there is no signature info at all", () => {
    const localPeer = makeLocalPeer({ exePath: "/usr/local/bin/aac", signature: undefined });

    expect(deriveAgentAccessAttestationKey(localPeer)).toEqual({
      signatureKind: "path",
      signatureIdentity: "/usr/local/bin/aac",
    });
  });

  it("prefers the resolved parent's exe path over the immediate peer's for the path fallback", () => {
    const localPeer = makeLocalPeer({
      exePath: "/usr/local/bin/aac",
      parent: { pid: 1, processName: "cursor", exePath: "/Applications/Cursor.app/MacOS/Cursor" },
      signature: undefined,
    });

    expect(deriveAgentAccessAttestationKey(localPeer)).toEqual({
      signatureKind: "path",
      signatureIdentity: "/Applications/Cursor.app/MacOS/Cursor",
    });
  });

  it("keys on linuxPathOnly identity directly, since it's already path-based", () => {
    const localPeer = makeLocalPeer({
      signature: { kind: "linuxPathOnly", identity: "/usr/bin/cursor", valid: true },
    });

    expect(deriveAgentAccessAttestationKey(localPeer)).toEqual({
      signatureKind: "linuxPathOnly",
      signatureIdentity: "/usr/bin/cursor",
    });
  });
});

describe("deriveAgentAccessDisplayName", () => {
  it("prefers the resolved parent's process name", () => {
    const localPeer = makeLocalPeer({
      processName: "aac",
      parent: { pid: 1, processName: "Cursor", exePath: "/Applications/Cursor.app" },
    });

    expect(deriveAgentAccessDisplayName(localPeer)).toBe("Cursor");
  });

  it("falls back to the immediate peer's process name when there is no parent", () => {
    const localPeer = makeLocalPeer({ processName: "aac", parent: undefined });

    expect(deriveAgentAccessDisplayName(localPeer)).toBe("aac");
  });

  it("returns undefined when neither name is available", () => {
    const localPeer = makeLocalPeer({ processName: undefined, parent: undefined });

    expect(deriveAgentAccessDisplayName(localPeer)).toBeUndefined();
  });

  it("returns undefined when localPeer itself is undefined", () => {
    expect(deriveAgentAccessDisplayName(undefined)).toBeUndefined();
  });

  describe("with an OpenShell key (§M8.5)", () => {
    const openshell = {
      gatewayEndpoint: "https://127.0.0.1:17670",
      sandboxId: "sbx-01J9Z6",
      providerId: "prov-7f3a",
    };

    it("adds the OpenShell key to the attested gateway identity", () => {
      const key = deriveAgentAccessAttestationKey(
        {
          pid: 2,
          exePath: "/usr/bin/aac",
          parent: { pid: 1, exePath: "/usr/bin/openshell-gateway" },
          signature: {
            kind: "linuxPathOnly" as agent_access.SignatureKindData,
            identity: "/usr/bin/openshell-gateway",
            valid: false,
          },
        } as agent_access.LocalPeerInfoData,
        { ...openshell, extra: "ignored" } as typeof openshell,
      );
      expect(key).toEqual({
        signatureKind: PATH_SIGNATURE_KIND,
        signatureIdentity: "/usr/bin/openshell-gateway",
        openshell,
      });
    });

    it("omits the OpenShell part entirely for a plain local key", () => {
      const key = deriveAgentAccessAttestationKey({
        pid: 2,
        exePath: "/usr/bin/aac",
      } as agent_access.LocalPeerInfoData);
      expect("openshell" in key).toBe(false);
    });
  });
});
