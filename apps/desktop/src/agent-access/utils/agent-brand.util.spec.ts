import { AgentId } from "../models/agent-id";

import { resolveAgentBrand } from "./agent-brand.util";

describe("resolveAgentBrand", () => {
  describe("macOS team identities", () => {
    it("resolves Claude Code from its Developer ID team identity", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "macosTeamId",
          signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
          signatureValid: true,
        }),
      ).toBe(AgentId.Claude);
    });

    it("resolves Codex from its Developer ID team identity", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "macosTeamId",
          signatureIdentity: "2DC432GLL2:codex",
          signatureValid: true,
        }),
      ).toBe(AgentId.Codex);
    });

    it("matches case-insensitively", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "macosTeamId",
          signatureIdentity: "q6l2sf6ydw:COM.ANTHROPIC.CLAUDE-CODE",
          signatureValid: true,
        }),
      ).toBe(AgentId.Claude);
    });

    // The whole point of keying on `teamId:bundleId` rather than the bundle id alone: Apple issues
    // team IDs, so a look-alike bundle id signed by anyone else cannot borrow the brand.
    it("does not resolve a look-alike bundle id under a different team ID", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "macosTeamId",
          signatureIdentity: "EVIL123456:com.anthropic.claude-code",
          signatureValid: true,
        }),
      ).toBeUndefined();
    });

    it("does not resolve a bare bundle id with no team ID", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "macosTeamId",
          signatureIdentity: "com.anthropic.claude-code",
          signatureValid: true,
        }),
      ).toBeUndefined();
    });
  });

  describe("Windows publishers", () => {
    it("resolves from a publisher common name prefix", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "windowsPublisher",
          signatureIdentity: "Anthropic PBC",
          signatureValid: true,
        }),
      ).toBe(AgentId.Claude);
    });

    it("tolerates legal-suffix punctuation differences", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "windowsPublisher",
          signatureIdentity: "Anthropic, PBC",
          signatureValid: true,
        }),
      ).toBe(AgentId.Claude);
    });

    it("does not resolve a publisher that merely contains a vendor name later in the string", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "windowsPublisher",
          signatureIdentity: "Not Anthropic Ltd",
          signatureValid: true,
        }),
      ).toBeUndefined();
    });
  });

  describe("verification gate", () => {
    it.each([[false], [undefined]])(
      "returns undefined for a known identity when signatureValid is %s",
      (signatureValid) => {
        expect(
          resolveAgentBrand({
            signatureKind: "macosTeamId",
            signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
            signatureValid,
          }),
        ).toBeUndefined();
      },
    );

    // linuxPathOnly reports `valid: true` but is not a real signature — it must never brand.
    it("returns undefined for a linuxPathOnly descriptor", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "linuxPathOnly",
          signatureIdentity: "/usr/local/bin/claude",
          signatureValid: true,
        }),
      ).toBeUndefined();
    });

    it("returns undefined when no signature info was captured", () => {
      expect(resolveAgentBrand({})).toBeUndefined();
    });

    it("returns undefined for an empty or whitespace identity", () => {
      expect(
        resolveAgentBrand({
          signatureKind: "macosTeamId",
          signatureIdentity: "   ",
          signatureValid: true,
        }),
      ).toBeUndefined();
    });
  });

  it("returns undefined for an unrecognized signed application", () => {
    expect(
      resolveAgentBrand({
        signatureKind: "macosTeamId",
        signatureIdentity: "ABCDE12345:com.example.someeditor",
        signatureValid: true,
      }),
    ).toBeUndefined();
  });
});
