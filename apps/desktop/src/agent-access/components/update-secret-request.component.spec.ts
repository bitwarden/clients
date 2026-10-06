import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { AgentId } from "../models/agent-id";
import { SmProjectMatch } from "../services/agent-access-secrets.service";

import {
  UpdateSecretRequestComponent,
  UpdateSecretRequestParams,
  UpdateSecretRequestResult,
} from "./update-secret-request.component";

const UserOne = "user-1" as UserId;

function makeParams(overrides: Partial<UpdateSecretRequestParams> = {}): UpdateSecretRequestParams {
  return {
    secretName: "DB_PASSWORD",
    changes: {},
    userId: UserOne,
    ...overrides,
  };
}

describe("UpdateSecretRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<UpdateSecretRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<UpdateSecretRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(params: UpdateSecretRequestParams): UpdateSecretRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new UpdateSecretRequestComponent());
  }

  describe("project picker visibility", () => {
    it("hides the picker when no project move was proposed", () => {
      const component = createComponent(makeParams({ changes: {} }));
      expect(component["showProjectPicker"]()).toBe(false);
    });

    it("shows the picker when a project move was proposed", () => {
      const component = createComponent(makeParams({ changes: { project: { toHint: "my-app" } } }));
      expect(component["showProjectPicker"]()).toBe(true);
    });
  });

  describe("submit", () => {
    it("approves with no projectId when no move was proposed", async () => {
      const component = createComponent(makeParams({ changes: { name: { from: "A", to: "B" } } }));

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: undefined });
    });

    it("approves with no projectId when a move was proposed but the user left it at 'do not move'", async () => {
      const component = createComponent(
        makeParams({
          changes: { project: { toHint: "my-app" } },
          writableProjects: [{ id: "proj-1", name: "my-app", write: true } as SmProjectMatch],
        }),
      );

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: undefined });
    });

    it("approves with the preselected projectId when the hint matched a writable project", async () => {
      const component = createComponent(
        makeParams({
          changes: { project: { toHint: "my-app" } },
          writableProjects: [{ id: "proj-1", name: "my-app", write: true } as SmProjectMatch],
          preselectedProjectId: "proj-1",
        }),
      );

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: "proj-1" });
    });

    it("approves with an explicitly-picked projectId, overriding the preselect", async () => {
      const component = createComponent(
        makeParams({
          changes: { project: { toHint: "my-app" } },
          writableProjects: [
            { id: "proj-1", name: "my-app", write: true } as SmProjectMatch,
            { id: "proj-2", name: "other-app", write: true } as SmProjectMatch,
          ],
          preselectedProjectId: "proj-1",
        }),
      );
      component["updateSecretRequestForm"].patchValue({ projectId: "proj-2" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: "proj-2" });
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
    it("falls back to a shortened fingerprint when no requester name is present", () => {
      const component = createComponent(makeParams({ requesterFingerprint: "abcdef123456" }));

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });
  });

  describe("consequence grade", () => {
    it("exposes the change grade for the shared consequence band, regardless of which changes are present", () => {
      const component = createComponent(
        makeParams({ changes: { name: { from: "A", to: "B" }, value: "generated" } }),
      );

      expect(component["AgentAccessConsequence"].Change).toBe(AgentAccessConsequence.Change);
      expect(component["consequenceSummary"]).toBe("agentAccessUpdateConsequenceSummary");
    });
  });

  // agent-access-design-spec.md §7.5.2 — the reported scope regression: the agent's brand logo
  // must appear on every request dialog, but only when it derives from an ATTESTED (verified
  // code-signature) identity. `brand`/`brandLogo` are resolved from `params.signature*` only.
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
      expect(component["requesterView"].brandLogo).toBe(AGENT_LOGOS[AgentId.Claude]);
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

    // Regression test: `requesterName` is self-reported and must never let a spoofed name borrow
    // a known agent's logo — only a verified code signature can (agent-access-design-spec.md
    // §7.5.2, constraint 2).
    it("does not resolve a logo from a spoofed requesterName claiming to be a known agent, with no signature present", () => {
      const component = createComponent(makeParams({ requesterName: "Claude Code" }));

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
      expect(component["requesterView"].name).toBe("Claude Code");
      expect(component["requesterView"].brandLogo).toBeUndefined();
    });
  });

  /**
   * Rendering tests — `createComponent` above (matching `ApproveCredentialRequestComponent`'s and
   * `ConfirmDeleteRequestComponent`'s precedent) never renders the template, so it can't catch a
   * regression in the shared-shell migration itself, in the before/after diff treatment replacing
   * the old `from + ' → ' + to` concatenated readonly inputs, or — most importantly — a future bug
   * that renders the proposed value. These use a real `TestBed.createComponent` fixture instead.
   */
  describe("rendering", () => {
    let fixture: ComponentFixture<UpdateSecretRequestComponent>;
    let renderedDialogRef: MockProxy<DialogRef<UpdateSecretRequestResult>>;

    beforeAll(() => {
      // jsdom does not implement IntersectionObserver; bit-dialog's scroll-shadow logic uses it
      // internally (mirrors the polyfill in agent-access-request-dialog.component.spec.ts and
      // confirm-delete-request.component.spec.ts).
      (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      };
    });

    async function render(params: UpdateSecretRequestParams) {
      renderedDialogRef = mock<DialogRef<UpdateSecretRequestResult>>();
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
        imports: [UpdateSecretRequestComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: renderedDialogRef },
          { provide: I18nService, useValue: i18nService },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(UpdateSecretRequestComponent);
      fixture.detectChanges();
    }

    const text = () => (fixture.nativeElement.textContent as string) ?? "";

    // Per design spec §7.5.1, the filled/left-ruled band is reserved for the two grades that
    // actually cost the user something (`Disclose`/`Destroy`). `Change` — this dialog's grade —
    // states the same sentence as plain text: a warning on four dialogs is a signal, on nine it
    // is wallpaper. The consequence is still stated, just not shouted.
    it("states the change grade's consequence as plain text, with no filled band", async () => {
      await render(makeParams({ changes: { name: { from: "A", to: "B" } } }));

      // Scope to the consequence element: a document-wide class query gives false positives,
      // because the primary submit button carries `tw-border-border-brand` of its own.
      const consequence = fixture.nativeElement.querySelector(
        "app-agent-access-consequence",
      ) as HTMLElement | null;

      expect(consequence).not.toBeNull();
      expect(consequence?.textContent).toContain("agentAccessUpdateConsequenceSummary");
      expect(consequence?.querySelector(".tw-border-s-4")).toBeNull();
      expect(consequence?.querySelector(".tw-bg-bg-brand-softer")).toBeNull();
      expect(consequence?.querySelector("bit-icon")).toBeNull();
    });

    it("renders the secret name in mono/sensitive styling", async () => {
      await render(makeParams({ secretName: "DB_PASSWORD" }));

      const nameEl = fixture.nativeElement.querySelector(
        ".tw-font-mono.tw-text-fg-sensitive",
      ) as HTMLElement | null;
      expect(nameEl?.textContent?.trim()).toBe("DB_PASSWORD");
    });

    it("renders a name change as a before/after pair", async () => {
      await render(makeParams({ changes: { name: { from: "OLD_NAME", to: "NEW_NAME" } } }));

      expect(text()).toContain("OLD_NAME");
      expect(text()).toContain("NEW_NAME");
      expect(text()).toContain("agentAccessUpdateNameChangeAria::OLD_NAME,NEW_NAME");
    });

    it("masks an agent-supplied value and never renders it, with no reveal control", async () => {
      await render(makeParams({ changes: { value: "agent" } }));

      expect(text()).toContain("agentAccessUpdateNewValueProposed");
      expect(text()).toContain("••••••••");
      // No password-reveal toggle exists anywhere in this dialog (unlike create-secret-request) —
      // the proposed value never reaches this component's params at all, so there is nothing a
      // reveal control could even show.
      expect(fixture.nativeElement.querySelector("[bitpasswordinputtoggle]")).toBeNull();
      expect(fixture.nativeElement.querySelector("input[type=password]")).toBeNull();
    });

    it("shows the generated-value reassurance instead of any value field when the value is generated", async () => {
      await render(makeParams({ changes: { value: "generated" } }));

      expect(text()).toContain("agentAccessUpdateGeneratedValueNotice");
      expect(text()).not.toContain("agentAccessUpdateNewValueProposed");
      expect(text()).not.toContain("••••••••");
    });

    it("shows the proposed note text when a new note is proposed", async () => {
      await render(makeParams({ changes: { note: { to: "Rotated on call." } } }));

      expect(text()).toContain("Rotated on call.");
      expect(text()).not.toContain("agentAccessUpdateNoteCleared");
    });

    it("shows the note-cleared notice when the proposed note is empty", async () => {
      await render(makeParams({ changes: { note: { to: "" } } }));

      expect(text()).toContain("agentAccessUpdateNoteCleared");
    });

    it("renders all three change kinds together, plus the project picker, without losing any of them", async () => {
      await render(
        makeParams({
          changes: {
            name: { from: "OLD_NAME", to: "NEW_NAME" },
            value: "generated",
            note: { to: "Rotated on call." },
            project: { toHint: "my-app" },
          },
          writableProjects: [{ id: "proj-1", name: "my-app", write: true } as SmProjectMatch],
          organizationName: "Acme Inc.",
        }),
      );

      expect(text()).toContain("OLD_NAME");
      expect(text()).toContain("NEW_NAME");
      expect(text()).toContain("agentAccessUpdateGeneratedValueNotice");
      expect(text()).toContain("Rotated on call.");
      expect(text()).toContain("Acme Inc.");
      expect(
        fixture.nativeElement.querySelector("#update-secret-request_select_project"),
      ).not.toBeNull();
      expect(text()).toContain("agentAccessUpdateMoveHint::my-app");
    });

    it("omits the project picker entirely when no move was proposed", async () => {
      await render(makeParams({ changes: { name: { from: "A", to: "B" } } }));

      expect(
        fixture.nativeElement.querySelector("#update-secret-request_select_project"),
      ).toBeNull();
    });

    it("no longer prints the dialog title twice via a duplicated callout", async () => {
      await render(makeParams());

      const callouts = fixture.nativeElement.querySelectorAll("bit-callout");
      for (const callout of Array.from(callouts) as HTMLElement[]) {
        expect(callout.getAttribute("title")).not.toBe("agentAccessUpdateRequestTitle");
      }
    });

    it("closes with the picked project id when the authorize button is submitted", async () => {
      await render(
        makeParams({
          changes: { project: { toHint: "my-app" } },
          writableProjects: [{ id: "proj-1", name: "my-app", write: true } as SmProjectMatch],
          preselectedProjectId: "proj-1",
        }),
      );

      const authorizeButton = fixture.nativeElement.querySelector(
        "#update-secret-request_button_authorize",
      ) as HTMLButtonElement;
      authorizeButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedDialogRef.close).toHaveBeenCalledWith({
        approved: true,
        projectId: "proj-1",
      });
    });
  });
});
