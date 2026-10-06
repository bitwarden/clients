import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

    const i18nService = mock<I18nService>();
    // Echoes the key plus any placeholder args, so `resolvedDescriptor`'s tests below can assert
    // both which key was chosen (signedBy/publishedBy/path) and what value was interpolated.
    i18nService.t.mockImplementation((key: string, ...args: (string | number)[]) =>
      args.length > 0 ? `${key}::${args.join(",")}` : key,
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: i18nService },
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

  describe("resolvedDescriptor", () => {
    it("resolves the signedBy sentence with the signature identity for a verified macOS signature", () => {
      const component = createComponent({
        displayName: "Cursor",
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID123:com.anysphere.cursor",
        signatureValid: true,
      });

      expect(component["resolvedDescriptor"]()).toBe(
        "agentAccessFirstUseSignedBy::TEAMID123:com.anysphere.cursor",
      );
    });

    it("resolves the publishedBy sentence with the signature identity for a verified Windows publisher", () => {
      const component = createComponent({
        displayName: "Cursor",
        signatureKind: "windowsPublisher",
        signatureIdentity: "CN=Anysphere, Inc.",
        signatureValid: true,
      });

      expect(component["resolvedDescriptor"]()).toBe(
        "agentAccessFirstUsePublishedBy::CN=Anysphere, Inc.",
      );
    });

    it("resolves the at-path sentence with the path descriptor value when there is no verified signature", () => {
      const component = createComponent({
        displayName: "Unknown application",
        exePath: "/usr/local/bin/some-agent",
      });

      expect(component["resolvedDescriptor"]()).toBe(
        "agentAccessFirstUseAtPath::/usr/local/bin/some-agent",
      );
    });
  });

  describe("requesterView", () => {
    it("assembles name, descriptor, brand logo, and unverified for app-agent-access-requester", () => {
      const component = createComponent({
        displayName: "claude",
        exePath: "/Users/someone/.local/bin/claude",
        signatureKind: "macosTeamId",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
        signatureValid: true,
      });

      const view = component["requesterView"]();
      expect(view.name).toBe("Claude Code");
      expect(view.descriptor).toBe(
        "agentAccessFirstUseSignedBy::Q6L2SF6YDW:com.anthropic.claude-code",
      );
      expect(view.brandLogo).toBeDefined();
      expect(view.unverified).toBe(false);
    });

    it("flags unverified and omits a brand logo when a known identity fails signature verification", () => {
      const component = createComponent({
        displayName: "claude",
        signatureKind: "macosTeamId",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
        signatureValid: false,
      });

      const view = component["requesterView"]();
      expect(view.name).toBe("claude");
      expect(view.brandLogo).toBeUndefined();
      expect(view.unverified).toBe(true);
    });

    it("is not flagged unverified when there is simply no signature info to verify", () => {
      const component = createComponent({
        displayName: "Unknown application",
        exePath: "/usr/local/bin/some-agent",
      });

      expect(component["requesterView"]().unverified).toBe(false);
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

  /**
   * Rendering tests — everything above instantiates the component directly and never renders the
   * template, so it can't verify what the migration onto `app-agent-access-request-dialog` /
   * `app-agent-access-requester` (agent-access-design-spec.md §7) actually produces: the `change`
   * grade painting, the verified/unverified warning strip, all three descriptor kinds reaching the
   * DOM, and the pre-existing scope radio group / reassurance copy surviving the migration with no
   * loss of behaviour. These use a real `TestBed.createComponent` fixture instead.
   */
  describe("rendering", () => {
    let fixture: ComponentFixture<FirstUseAuthorizationDialogComponent>;
    let renderedDialogRef: MockProxy<DialogRef<FirstUseAuthorizationDialogResult>>;

    beforeAll(() => {
      // jsdom does not implement IntersectionObserver; bit-dialog's scroll-shadow logic uses it
      // internally (mirrors the polyfill in offboarding-survey.component.spec.ts and
      // agent-access-request-dialog.component.spec.ts).
      (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      };
    });

    async function render(params: FirstUseAuthorizationDialogParams) {
      renderedDialogRef = mock<DialogRef<FirstUseAuthorizationDialogResult>>();
      // jest-mock-extended proxies every unset property access as a truthy mock function.
      // DialogComponent branches on `disableClose`/`isDrawer` to decide whether to render its
      // close button and how to route it — see agent-access-request-dialog.component.spec.ts for
      // the full explanation of this gotcha.
      renderedDialogRef.disableClose = false;
      renderedDialogRef.isDrawer = false;

      const i18nService = mock<I18nService>();
      i18nService.t.mockImplementation((key: string, ...args: (string | number)[]) =>
        args.length > 0 ? `${key}::${args.join(",")}` : key,
      );

      await TestBed.configureTestingModule({
        imports: [FirstUseAuthorizationDialogComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: renderedDialogRef },
          { provide: I18nService, useValue: i18nService },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(FirstUseAuthorizationDialogComponent);
      fixture.detectChanges();
    }

    const text = () => (fixture.nativeElement.textContent as string) ?? "";
    const submitButton = () =>
      fixture.nativeElement.querySelector(
        "#first-use-authorization-dialog_button_authorize",
      ) as HTMLButtonElement;

    // Per design spec §7.5.1, the filled/left-ruled consequence band is reserved for the two
    // grades that actually cost the user something (`Disclose`/`Destroy`). `Change` — this
    // dialog's grade — states the same sentence as plain text: a warning on four dialogs is a
    // signal, on nine it is wallpaper. The consequence must still be stated, just not shouted.
    it("states the change grade's consequence as plain text, with no filled band", async () => {
      await render({ displayName: "Cursor" });

      // Scope every assertion to the consequence element itself. A document-wide class query
      // gives false positives: the primary "authorize" button legitimately carries
      // `tw-border-border-brand` of its own.
      const consequence = fixture.nativeElement.querySelector(
        "app-agent-access-consequence",
      ) as HTMLElement | null;

      expect(consequence).not.toBeNull();
      expect(consequence?.textContent).toContain("agentAccessFirstUseConsequenceSummary");
      // Plain treatment: no left rule, no filled background, no grade icon.
      expect(consequence?.querySelector(".tw-border-s-4")).toBeNull();
      expect(consequence?.querySelector(".tw-bg-bg-brand-softer")).toBeNull();
      expect(consequence?.querySelector("bit-icon")).toBeNull();
    });

    it("shows the unverified warning strip only for a signature that failed verification", async () => {
      await render({
        displayName: "Suspicious",
        exePath: "/Applications/Suspicious.app",
        signatureKind: "macosTeamId",
        signatureIdentity: "/Applications/Suspicious.app",
        signatureValid: false,
      });

      expect(text()).toContain("agentAccessRequesterSignatureUnverified");
    });

    it("does not show the unverified warning strip for a verified signature", async () => {
      await render({
        displayName: "Cursor",
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID123:com.anysphere.cursor",
        signatureValid: true,
      });

      expect(text()).not.toContain("agentAccessRequesterSignatureUnverified");
    });

    it("does not show the unverified warning strip when there is simply no signature info", async () => {
      await render({ displayName: "Unknown application", exePath: "/usr/local/bin/some-agent" });

      expect(text()).not.toContain("agentAccessRequesterSignatureUnverified");
    });

    it("renders the signedBy descriptor for a verified macOS team ID signature", async () => {
      await render({
        displayName: "Cursor",
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID123:com.anysphere.cursor",
        signatureValid: true,
      });

      expect(text()).toContain("agentAccessFirstUseSignedBy::TEAMID123:com.anysphere.cursor");
      expect(text()).not.toContain("agentAccessFirstUseWeakerGuaranteeNote");
    });

    it("renders the publishedBy descriptor for a verified Windows publisher signature", async () => {
      await render({
        displayName: "Cursor",
        signatureKind: "windowsPublisher",
        signatureIdentity: "CN=Anysphere, Inc.",
        signatureValid: true,
      });

      expect(text()).toContain("agentAccessFirstUsePublishedBy::CN=Anysphere, Inc.");
      expect(text()).not.toContain("agentAccessFirstUseWeakerGuaranteeNote");
    });

    it("renders the at-path descriptor plus the weaker-guarantee note when there's no verified signature", async () => {
      await render({ displayName: "Unknown application", exePath: "/usr/local/bin/some-agent" });

      expect(text()).toContain("agentAccessFirstUseAtPath::/usr/local/bin/some-agent");
      expect(text()).toContain("agentAccessFirstUseWeakerGuaranteeNote");
    });

    it("renders the scope radio group and the binary-identity caveat", async () => {
      await render({ displayName: "Cursor" });

      expect(
        fixture.nativeElement.querySelector(
          "#first-use-authorization-dialog_radio_scope-all-logins",
        ),
      ).not.toBeNull();
      expect(text()).toContain("agentAccessFirstUseCaveat");
    });

    it("closes with authorized: true and the selected scope when the form is submitted", async () => {
      await render({ displayName: "Cursor" });

      submitButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedDialogRef.close).toHaveBeenCalledWith({
        authorized: true,
        scope: AgentAccessGrantScope.AllLogins,
      });
    });
  });
});
