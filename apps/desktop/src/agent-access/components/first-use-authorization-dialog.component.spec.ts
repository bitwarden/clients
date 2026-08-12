import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AgentAccessGrantScope } from "../models/agent-access-grant";

import {
  FirstUseAuthorizationDialogComponent,
  FirstUseAuthorizationDialogParams,
  FirstUseAuthorizationDialogResult,
} from "./first-use-authorization-dialog.component";

describe("FirstUseAuthorizationDialogComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<FirstUseAuthorizationDialogResult>>;

  /** Instantiates the component directly, matching ApproveCredentialRequestComponent's spec
   *  style — avoids bringing in every Bitwarden dialog chrome dependency just to exercise the
   *  descriptor/scope/submit logic. */
  function createComponent(
    params: FirstUseAuthorizationDialogParams,
  ): FirstUseAuthorizationDialogComponent {
    mockDialogRef = mock<DialogRef<FirstUseAuthorizationDialogResult>>();

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
      ],
    });

    return TestBed.runInInjectionContext(() => new FirstUseAuthorizationDialogComponent());
  }

  describe("descriptorKind", () => {
    it("is signedBy for a valid macOS team ID signature", () => {
      const component = createComponent({
        displayName: "Cursor",
        exePath: "/Applications/Cursor.app",
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID123:com.anysphere.cursor",
        signatureValid: true,
      });

      expect(component["descriptorKind"]()).toBe("signedBy");
    });

    it("is publishedBy for a valid Windows publisher signature", () => {
      const component = createComponent({
        displayName: "Cursor",
        signatureKind: "windowsPublisher",
        signatureIdentity: "CN=Anysphere, Inc.",
        signatureValid: true,
      });

      expect(component["descriptorKind"]()).toBe("publishedBy");
    });

    it("is path for linuxPathOnly, even though the signature reports valid: true", () => {
      const component = createComponent({
        displayName: "Cursor",
        exePath: "/usr/bin/cursor",
        signatureKind: "linuxPathOnly",
        signatureIdentity: "/usr/bin/cursor",
        signatureValid: true,
      });

      expect(component["descriptorKind"]()).toBe("path");
      expect(component["pathDescriptorValue"]()).toBe("/usr/bin/cursor");
    });

    it("is path when a macOS signature failed verification, and flags it as unverified", () => {
      const component = createComponent({
        displayName: "Suspicious",
        exePath: "/Applications/Suspicious.app",
        signatureKind: "macosTeamId",
        signatureIdentity: "/Applications/Suspicious.app",
        signatureValid: false,
      });

      expect(component["descriptorKind"]()).toBe("path");
      expect(component["signatureInvalid"]()).toBe(true);
    });

    it("is path with no unverified flag when there is no signature info at all", () => {
      const component = createComponent({
        displayName: "Unknown application",
        exePath: "/usr/local/bin/some-agent",
      });

      expect(component["descriptorKind"]()).toBe("path");
      expect(component["signatureInvalid"]()).toBe(false);
      expect(component["pathDescriptorValue"]()).toBe("/usr/local/bin/some-agent");
    });
  });

  describe("brand", () => {
    it("resolves the logo and product name for a verified known agent", () => {
      const component = createComponent({
        displayName: "claude",
        exePath: "/Users/someone/.local/bin/claude",
        signatureKind: "macosTeamId",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
        signatureValid: true,
      });

      expect(component["brand"]()).toBe("claude");
      expect(component["brandLogo"]()).toBeDefined();
      expect(component["requesterName"]()).toBe("Claude Code");
    });

    it("falls back to the attested process name with no logo for an unknown application", () => {
      const component = createComponent({
        displayName: "some-agent",
        signatureKind: "macosTeamId",
        signatureIdentity: "ABCDE12345:com.example.someagent",
        signatureValid: true,
      });

      expect(component["brand"]()).toBeUndefined();
      expect(component["brandLogo"]()).toBeUndefined();
      expect(component["requesterName"]()).toBe("some-agent");
    });

    // A look-alike binary must not be able to borrow a familiar brand mark by name alone.
    it("shows no logo when a known identity failed signature verification", () => {
      const component = createComponent({
        displayName: "claude",
        signatureKind: "macosTeamId",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
        signatureValid: false,
      });

      expect(component["brand"]()).toBeUndefined();
      expect(component["brandLogo"]()).toBeUndefined();
      expect(component["requesterName"]()).toBe("claude");
    });
  });

  describe("scope", () => {
    it("defaults to allLogins, the only Phase 1 option, and is valid without user input", () => {
      const component = createComponent({ displayName: "Cursor" });

      expect(component["firstUseAuthorizationForm"].value.scope).toBe("allLogins");
      expect(component["firstUseAuthorizationForm"].valid).toBe(true);
    });
  });

  describe("submit", () => {
    it("closes with authorized: true and the selected scope", async () => {
      const component = createComponent({ displayName: "Cursor" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        authorized: true,
        scope: AgentAccessGrantScope.AllLogins,
      });
    });
  });

  describe("deny", () => {
    it("closes with authorized: false", async () => {
      const component = createComponent({ displayName: "Cursor" });

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ authorized: false });
    });
  });
});
