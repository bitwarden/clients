import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { AgentId } from "../models/agent-id";

import {
  ConfirmDeleteRequestComponent,
  ConfirmDeleteRequestParams,
  ConfirmDeleteRequestResult,
} from "./confirm-delete-request.component";

function makeParams(
  overrides: Partial<ConfirmDeleteRequestParams> = {},
): ConfirmDeleteRequestParams {
  return {
    kind: "secret",
    itemName: "DB_PASSWORD",
    ...overrides,
  };
}

describe("ConfirmDeleteRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ConfirmDeleteRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<ConfirmDeleteRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(params: ConfirmDeleteRequestParams): ConfirmDeleteRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ConfirmDeleteRequestComponent());
  }

  describe("isProject", () => {
    it("is false for a secret delete", () => {
      const component = createComponent(makeParams({ kind: "secret" }));
      expect(component["isProject"]()).toBe(false);
    });

    it("is true for a project delete", () => {
      const component = createComponent(makeParams({ kind: "project" }));
      expect(component["isProject"]()).toBe(true);
    });
  });

  describe("submit", () => {
    it("closes with approved: true", async () => {
      const component = createComponent(makeParams());

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true });
    });
  });

  describe("deny", () => {
    it("closes with approved: false", async () => {
      const component = createComponent(makeParams());

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });

  describe("requesterDisplayName", () => {
    it("falls back to the unknown-application label when no name or fingerprint is present", () => {
      const component = createComponent(makeParams());
      expect(component["requesterDisplayName"]).toBe("agentAccessUnknownApplication");
    });

    it("prefers the requester name", () => {
      const component = createComponent(makeParams({ requesterName: "Cursor" }));
      expect(component["requesterDisplayName"]).toBe("Cursor");
    });
  });

  // agent-access-design-spec.md §7.5.2 — the reported scope regression: the agent's brand logo
  // must appear on every request dialog, including this one, but only when it derives from an
  // ATTESTED (verified code-signature) identity. `brand`/`brandLogo` are resolved from
  // `params.signature*` only.
  describe("brandLogo", () => {
    it("resolves the brand logo for a verified signature matching a known agent", () => {
      const component = createComponent(
        makeParams({
          signatureKind: "macosTeamId",
          signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
          signatureValid: true,
        }),
      );

      expect(component["brand"]).toBe(AgentId.Claude);
      expect(component["brandLogo"]).toBe(AGENT_LOGOS[AgentId.Claude]);
      expect(component["requesterView"]().brandLogo).toBe(AGENT_LOGOS[AgentId.Claude]);
    });

    it("falls back to the neutral glyph for a verified signature with no matching brand", () => {
      const component = createComponent(
        makeParams({
          signatureKind: "macosTeamId",
          signatureIdentity: "ABCDE12345:com.example.someagent",
          signatureValid: true,
        }),
      );

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
    });

    // Security regression test: an invalid/unverified signature must never resolve a logo, even
    // when the identity string exactly matches a known agent's registered entry.
    it("never resolves a logo for an invalid/unverified signature, even when the identity would otherwise match a known agent", () => {
      const component = createComponent(
        makeParams({
          signatureKind: "macosTeamId",
          signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
          signatureValid: false,
        }),
      );

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
    });

    // Security regression test: `requesterName` is self-reported and must never let a spoofed
    // name borrow a known agent's logo — only a verified code signature can (agent-access-
    // design-spec.md §7.5.2, constraint 2). The name still displays as plain text.
    it("does not resolve a logo from a spoofed requesterName claiming to be a known agent, with no signature present", () => {
      const component = createComponent(makeParams({ requesterName: "Claude Code" }));

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
      expect(component["requesterView"]().name).toBe("Claude Code");
      expect(component["requesterView"]().brandLogo).toBeUndefined();
    });
  });

  describe("params passthrough", () => {
    it("exposes the resolved item name and contained secret count, display-only", () => {
      const component = createComponent(
        makeParams({ kind: "project", itemName: "my-app", containedSecretCount: 3 }),
      );

      expect(component.params.itemName).toBe("my-app");
      expect(component.params.containedSecretCount).toBe(3);
    });
  });

  /**
   * Rendering tests — `createComponent` above (matching `ApproveCredentialRequestComponent`'s
   * precedent) never renders the template, so it can't catch a regression in the shared-shell
   * migration itself: the destroy grade actually painting, the two delete branches actually
   * producing different copy, or the item name actually landing in `fg-sensitive` styling rather
   * than as an unstyled value. These use a real `TestBed.createComponent` fixture instead.
   */
  describe("rendering", () => {
    let fixture: ComponentFixture<ConfirmDeleteRequestComponent>;
    let renderedDialogRef: MockProxy<DialogRef<ConfirmDeleteRequestResult>>;

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

    async function render(params: ConfirmDeleteRequestParams) {
      renderedDialogRef = mock<DialogRef<ConfirmDeleteRequestResult>>();
      // jest-mock-extended proxies every unset property access as a truthy mock function.
      // DialogComponent branches on `disableClose`/`isDrawer` to decide whether to render its
      // close button and how to route it — see agent-access-request-dialog.component.spec.ts for
      // the full explanation of this gotcha.
      renderedDialogRef.disableClose = false;
      renderedDialogRef.isDrawer = false;

      const i18nService = mock<I18nService>();
      // Echoes the key, plus any placeholder args, so branch-specific keys (and the
      // contained-secret count passed to them) are both distinguishable in rendered text.
      i18nService.t.mockImplementation((key: string, ...args: (string | number)[]) =>
        args.length > 0 ? `${key}::${args.join(",")}` : key,
      );

      await TestBed.configureTestingModule({
        imports: [ConfirmDeleteRequestComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: renderedDialogRef },
          { provide: I18nService, useValue: i18nService },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ConfirmDeleteRequestComponent);
      fixture.detectChanges();
    }

    const text = () => (fixture.nativeElement.textContent as string) ?? "";
    const authorizeButton = () =>
      fixture.nativeElement.querySelector(
        "#confirm-delete-request_button_authorize",
      ) as HTMLButtonElement;

    it("renders the destroy grade's danger-family styling for a secret delete", async () => {
      await render(makeParams({ kind: "secret", itemName: "DB_PASSWORD" }));

      const consequenceBand = fixture.nativeElement.querySelector(
        ".tw-border-border-danger",
      ) as HTMLElement | null;
      expect(consequenceBand).not.toBeNull();
      expect(consequenceBand?.className).toContain("tw-bg-bg-danger-soft");
    });

    it("states the secret case is recoverable via trash, not the project's permanent warning", async () => {
      await render(makeParams({ kind: "secret", itemName: "DB_PASSWORD" }));

      expect(text()).toContain("agentAccessDeleteSecretTrashNotice");
      expect(text()).not.toContain("agentAccessDeleteProjectPermanentWarning");
    });

    it("states the project case is permanent and shows the known contained-secret count", async () => {
      await render(makeParams({ kind: "project", itemName: "my-app", containedSecretCount: 12 }));

      expect(text()).toContain("agentAccessDeleteProjectPermanentWarning");
      expect(text()).toContain("agentAccessDeleteProjectContainedSecretsWarning::12");
      expect(text()).not.toContain("agentAccessDeleteSecretTrashNotice");
    });

    it("falls back to the unknown-count caveat when the contained count couldn't be resolved", async () => {
      await render(makeParams({ kind: "project", itemName: "my-app" }));

      expect(text()).toContain("agentAccessDeleteProjectPermanentWarning");
      expect(text()).toContain("agentAccessDeleteProjectContainedSecretsUnknownWarning");
      expect(text()).not.toContain("agentAccessDeleteProjectContainedSecretsWarning::");
    });

    it("renders the item name in mono/sensitive styling and never renders a value", async () => {
      await render(makeParams({ kind: "secret", itemName: "DB_PASSWORD" }));

      const nameEl = fixture.nativeElement.querySelector(
        ".tw-font-mono.tw-text-fg-sensitive",
      ) as HTMLElement | null;
      expect(nameEl?.textContent?.trim()).toBe("DB_PASSWORD");
    });

    it("keeps the confirm action styled as a danger button", async () => {
      await render(makeParams({ kind: "secret", itemName: "DB_PASSWORD" }));

      expect(authorizeButton()).not.toBeNull();
      expect(authorizeButton().classList.contains("tw-bg-bg-danger")).toBe(true);
    });

    it("closes with approved: true when the danger confirm button is clicked", async () => {
      await render(makeParams({ kind: "secret", itemName: "DB_PASSWORD" }));

      authorizeButton().click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedDialogRef.close).toHaveBeenCalledWith({ approved: true });
    });
  });
});
