import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessConsequence } from "../models/agent-access-consequence";
import { AgentId } from "../models/agent-id";

import { CredentialLoginMatch } from "./approve-credential-request.component";
import {
  ApproveFillRequestComponent,
  ApproveFillRequestParams,
  ApproveFillRequestResult,
} from "./approve-fill-request.component";

function makeMatch(overrides: Partial<CredentialLoginMatch> = {}): CredentialLoginMatch {
  return {
    kind: "credential",
    cipherId: "c1",
    cipherName: "Example",
    username: "user@example.com",
    fieldsShared: { username: true, password: true, totp: false, uri: false },
    ...overrides,
  };
}

function makeParams(overrides: Partial<ApproveFillRequestParams> = {}): ApproveFillRequestParams {
  return {
    requesterName: "Cursor",
    origin: "https://example.com",
    matches: [makeMatch()],
    fieldPlan: [
      { role: "username", target: "input#email (login form)" },
      { role: "password", target: "input[type=password]#pw" },
    ],
    skipped: [],
    ...overrides,
  };
}

describe("ApproveFillRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ApproveFillRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  /** Instantiates the component directly (matching ApproveCredentialRequestComponent's spec
   *  style) rather than rendering the full template — avoids bringing in every Bitwarden dialog
   *  chrome dependency just to exercise the picker/validation logic. */
  function createComponent(params: ApproveFillRequestParams): ApproveFillRequestComponent {
    mockDialogRef = mock<DialogRef<ApproveFillRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ApproveFillRequestComponent());
  }

  describe("origin", () => {
    it("exposes the extension-reported origin for the template's dominant element", () => {
      const component = createComponent(makeParams({ origin: "https://bitnotes.io" }));

      expect(component["params"].origin).toBe("https://bitnotes.io");
    });
  });

  describe("single match", () => {
    it("preselects the only match and does not require a selection", () => {
      const match = makeMatch();
      const component = createComponent(makeParams({ matches: [match] }));

      expect(component["hasMultipleMatches"]).toBe(false);
      expect(component["approveFillRequestForm"].valid).toBe(true);
      expect(component["selectedMatch"]()).toEqual(match);
    });

    it("approves the single match on submit", async () => {
      const component = createComponent(makeParams());

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c1" });
    });
  });

  describe("multiple matches (picker)", () => {
    const matches = [
      makeMatch({ cipherId: "c1", cipherName: "GitHub", username: "personal@example.com" }),
      makeMatch({ cipherId: "c2", cipherName: "GitHub", username: "work@example.com" }),
    ];

    it("requires a selection and does not close the dialog until one is made", async () => {
      const component = createComponent(makeParams({ matches }));

      expect(component["hasMultipleMatches"]).toBe(true);
      expect(component["approveFillRequestForm"].valid).toBe(false);

      await component.submit();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("approves only the selected cipher id on submit", async () => {
      const component = createComponent(makeParams({ matches }));
      component["approveFillRequestForm"].patchValue({ selectedId: "c2" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c2" });
    });

    it("tracks the highlighted match as the radio selection changes", () => {
      const component = createComponent(makeParams({ matches }));

      component["approveFillRequestForm"].patchValue({ selectedId: "c2" });

      expect(component["selectedMatch"]()?.cipherId).toBe("c2");
    });
  });

  describe("field plan", () => {
    it("exposes the planned roles with their target descriptors and localized role labels", () => {
      const component = createComponent(
        makeParams({
          fieldPlan: [
            { role: "username", target: "input#email (login form)" },
            { role: "totp", target: "input#otp (login form)" },
          ],
          skipped: [{ role: "password", reason: "no-password-field" }],
        }),
      );

      expect(component["params"].fieldPlan).toEqual([
        { role: "username", target: "input#email (login form)" },
        { role: "totp", target: "input#otp (login form)" },
      ]);
      expect(component["params"].skipped).toEqual([
        { role: "password", reason: "no-password-field" },
      ]);
      // Role labels resolve through i18n (totp renders as the verification-code label).
      expect(component["roleLabel"]("username")).toBe("username");
      expect(component["roleLabel"]("totp")).toBe("verificationCode");
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
      const component = createComponent(
        makeParams({ requesterName: undefined, requesterFingerprint: "abcdef123456" }),
      );

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });

    it("falls back to the unknown-application i18n string when neither name nor fingerprint is present", () => {
      const component = createComponent(
        makeParams({ requesterName: undefined, requesterFingerprint: undefined }),
      );

      expect(component["requesterDisplayName"]).toBe("agentAccessUnknownApplication");
    });
  });

  describe("matchDisambiguator", () => {
    it("uses the username when present", () => {
      const component = createComponent(makeParams());
      const match = makeMatch({ username: "user@example.com" });

      expect(component["matchDisambiguator"](match)).toBe("user@example.com");
    });

    it("falls back to a shortened, guaranteed-unique cipher id when the username is absent, so two identically-named cards never look the same", () => {
      const component = createComponent(makeParams());
      const withoutUsername = makeMatch({ cipherId: "cipher-id-12345", username: undefined });

      const disambiguator = component["matchDisambiguator"](withoutUsername);

      expect(disambiguator).not.toBe("");
      expect(disambiguator).toContain("cipher-i");
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
      const component = createComponent(
        makeParams({
          requesterName: "Claude Code",
          signatureKind: undefined,
          signatureIdentity: undefined,
          signatureValid: undefined,
        }),
      );

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
      expect(component["requesterView"].name).toBe("Claude Code");
      expect(component["requesterView"].brandLogo).toBeUndefined();
    });
  });

  describe("consequence grade", () => {
    it("is graded disclose and names the origin in the summary", () => {
      const component = createComponent(makeParams({ origin: "https://github.com" }));

      expect(component["AgentAccessConsequence"].Disclose).toBe(AgentAccessConsequence.Disclose);
      // The `createComponent` helper's mocked `i18nService.t` echoes only the key (see its
      // `mockImplementation` above), so this only confirms the right key and grade are wired up —
      // the rendering suite below confirms the origin actually lands in the rendered text.
      expect(component["consequenceSummary"]).toBe("agentAccessFillDiscloseSummary");
      expect(component["consequenceDetail"]).toBe("agentAccessFillAgentNotShownDetail");
    });
  });

  /**
   * Rendering tests — `createComponent` above (matching `ApproveCredentialRequestComponent`'s and
   * `ConfirmDeleteRequestComponent`'s precedent) never renders the template, so it can't catch a
   * regression in the shared-shell migration itself: the origin staying the visually dominant
   * element alongside the new consequence band, the disclose grade actually painting, the picker
   * cards actually staying distinguishable with no username, or the field-plan/skipped lists
   * actually rendering every entry. These use a real `TestBed.createComponent` fixture instead.
   */
  describe("rendering", () => {
    let fixture: ComponentFixture<ApproveFillRequestComponent>;
    let renderedDialogRef: MockProxy<DialogRef<ApproveFillRequestResult>>;

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

    async function render(params: ApproveFillRequestParams) {
      renderedDialogRef = mock<DialogRef<ApproveFillRequestResult>>();
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
        imports: [ApproveFillRequestComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: renderedDialogRef },
          { provide: I18nService, useValue: i18nService },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ApproveFillRequestComponent);
      fixture.detectChanges();
    }

    const text = () => (fixture.nativeElement.textContent as string) ?? "";
    const originHeading = () =>
      fixture.nativeElement.querySelector('[aria-live="polite"]') as HTMLElement | null;

    it("renders the disclose grade's warning-family styling on the consequence band", async () => {
      await render(makeParams());

      const consequenceBand = fixture.nativeElement.querySelector(
        ".tw-border-border-warning",
      ) as HTMLElement | null;
      expect(consequenceBand).not.toBeNull();
      expect(consequenceBand?.className).toContain("tw-bg-bg-warning-soft");
    });

    it("keeps the origin as its own aria-live heading, distinct from (and larger than) the consequence band's text", async () => {
      await render(makeParams({ origin: "https://bitnotes.io" }));

      const heading = originHeading();
      expect(heading).not.toBeNull();
      expect(heading?.tagName.toLowerCase()).toBe("h3");
      expect(heading?.textContent?.trim()).toBe("https://bitnotes.io");

      // The consequence band also names the origin, but only inside its own quiet one-line
      // summary — the dominant, large-type rendering stays the dedicated heading above.
      const band = fixture.nativeElement.querySelector(".tw-border-border-warning") as HTMLElement;
      expect(band.textContent).toContain("agentAccessFillDiscloseSummary");
      expect(band.contains(heading)).toBe(false);
    });

    it("renders a single match's name in mono/sensitive styling with no picker", async () => {
      await render(makeParams({ matches: [makeMatch({ cipherName: "GitHub" })] }));

      const nameEl = fixture.nativeElement.querySelector(
        ".tw-font-mono.tw-text-fg-sensitive",
      ) as HTMLElement | null;
      expect(nameEl?.textContent?.trim()).toBe("GitHub");
      expect(fixture.nativeElement.querySelector("bit-form-control-group")).toBeNull();
    });

    it("renders every match as a distinguishable card when there are multiple, even with identical names and no usernames", async () => {
      const matches = [
        makeMatch({ cipherId: "c1", cipherName: "API_KEY", username: undefined }),
        makeMatch({ cipherId: "c2", cipherName: "API_KEY", username: undefined }),
      ];
      await render(makeParams({ matches }));

      const cards = fixture.nativeElement.querySelectorAll("bit-form-control-card");
      expect(cards.length).toBe(2);
      const hints = Array.from(cards).map((card) =>
        (card as HTMLElement).querySelector("bit-hint")?.textContent?.trim(),
      );
      // Both cards share a name, but their fallback disambiguators (shortened cipher ids) must
      // differ — otherwise the user is picking blind (agent-access-design-spec.md §3.3, BUG 1).
      expect(hints[0]).not.toBe(hints[1]);
      expect(hints[0]).toBeTruthy();
      expect(hints[1]).toBeTruthy();
    });

    it("renders every field-plan entry and every skipped entry, dropping none", async () => {
      await render(
        makeParams({
          fieldPlan: [
            { role: "username", target: "input#email (login form)" },
            { role: "password", target: "input[type=password]#pw" },
          ],
          skipped: [{ role: "totp", reason: "no-otp-field" }],
        }),
      );

      expect(text()).toContain("input#email (login form)");
      expect(text()).toContain("input[type=password]#pw");
      expect(text()).toContain("agentAccessFillSkippedReason::no-otp-field");
    });

    it("no longer prints the dialog title twice via a duplicated callout", async () => {
      await render(makeParams());

      const callouts = fixture.nativeElement.querySelectorAll("bit-callout");
      for (const callout of Array.from(callouts) as HTMLElement[]) {
        expect(callout.getAttribute("title")).not.toBe("agentAccessFillTitle");
      }
    });

    it("closes with the selected cipher id when the authorize button is submitted", async () => {
      const matches = [
        makeMatch({ cipherId: "c1", cipherName: "GitHub" }),
        makeMatch({ cipherId: "c2", cipherName: "GitLab" }),
      ];
      await render(makeParams({ matches }));

      const radio = fixture.nativeElement.querySelector(
        "#approve-fill-request_radio_match-c2",
      ) as HTMLInputElement;
      radio.click();
      fixture.detectChanges();

      const authorizeButton = fixture.nativeElement.querySelector(
        "#approve-fill-request_button_authorize",
      ) as HTMLButtonElement;
      authorizeButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderedDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c2" });
    });
  });
});
