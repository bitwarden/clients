import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { AgentId } from "../models/agent-id";
import { CredentialQueryType } from "../models/credential-query-type";

import {
  ApproveCredentialRequestComponent,
  ApproveCredentialRequestParams,
  ApproveCredentialRequestResult,
  CredentialLoginMatch,
  CredentialMatch,
  SecretMatch,
} from "./approve-credential-request.component";

function makeMatch(overrides: Partial<CredentialLoginMatch> = {}): CredentialLoginMatch {
  return {
    kind: "credential",
    cipherId: "c1",
    cipherName: "Example",
    username: "user@example.com",
    fieldsShared: { username: true, password: true, totp: false, uri: true },
    ...overrides,
  };
}

function makeSecretMatch(overrides: Partial<SecretMatch> = {}): SecretMatch {
  return {
    kind: "secret",
    secretId: "s1",
    secretName: "DB_PASSWORD",
    organizationName: "Acme Inc",
    ...overrides,
  };
}

describe("ApproveCredentialRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ApproveCredentialRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  /** Instantiates the component directly (matching AgentAccessPairAgentDialogComponent's spec
   *  style) rather than rendering the full template — avoids bringing in every Bitwarden dialog
   *  chrome dependency just to exercise the picker/validation logic. */
  function createComponent(
    params: ApproveCredentialRequestParams,
  ): ApproveCredentialRequestComponent {
    mockDialogRef = mock<DialogRef<ApproveCredentialRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ApproveCredentialRequestComponent());
  }

  describe("single match", () => {
    it("preselects the only match and does not require a selection", () => {
      const match = makeMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [match],
        matchesTruncated: false,
      });

      expect(component["hasMultipleMatches"]).toBe(false);
      expect(component["approveCredentialRequestForm"].valid).toBe(true);
      expect(component["selectedMatch"]()).toEqual(match);
    });

    it("approves the single match on submit", async () => {
      const match = makeMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [match],
        matchesTruncated: false,
      });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c1" });
    });
  });

  describe("multiple matches", () => {
    function createMultiMatchComponent(): {
      component: ApproveCredentialRequestComponent;
      matches: CredentialMatch[];
    } {
      const matches = [
        makeMatch({ cipherId: "c1", cipherName: "GitHub (work)", username: "work@example.com" }),
        makeMatch({
          cipherId: "c2",
          cipherName: "GitHub (personal)",
          username: "personal@example.com",
        }),
      ];
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "github",
        matches,
        matchesTruncated: false,
      });
      return { component, matches };
    }

    it("requires a selection and does not close the dialog until one is made", async () => {
      const { component } = createMultiMatchComponent();

      expect(component["hasMultipleMatches"]).toBe(true);
      expect(component["approveCredentialRequestForm"].valid).toBe(false);
      expect(component["selectedMatch"]()).toBeUndefined();

      await component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("tracks the highlighted match as the radio selection changes", () => {
      const { component, matches } = createMultiMatchComponent();

      component["approveCredentialRequestForm"].patchValue({ selectedId: "c2" });

      expect(component["selectedMatch"]()).toEqual(matches[1]);
    });

    it("approves only the selected cipher id on submit", async () => {
      const { component } = createMultiMatchComponent();
      component["approveCredentialRequestForm"].patchValue({ selectedId: "c2" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c2" });
    });
  });

  // The dialog's reference-mode reassurance copy (see the component's `isReferenceMode`) hinges
  // on `params.deliveryMode` — these cover it reading true only for an explicit "reference" value
  // and false for every other case, including inject mode and an absent delivery mode (a secret
  // request, or a relay-origin credential request, carries none).
  describe("isReferenceMode", () => {
    it("is true for an explicit reference delivery mode", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        deliveryMode: "reference",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["isReferenceMode"]).toBe(true);
    });

    it("is false for inject delivery mode", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        deliveryMode: "inject",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["isReferenceMode"]).toBe(false);
    });

    it("is false when no delivery mode is present (secret requests, and relay-origin credential requests)", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["isReferenceMode"]).toBe(false);
    });
  });

  describe("deny", () => {
    it("closes with approved: false", async () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });

  describe("requesterDisplayName", () => {
    it("falls back to a shortened fingerprint when no requester name is present", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });

    it("falls back to the unknown-application i18n string, without throwing, when both requesterName and requesterFingerprint are absent", () => {
      // Regression test: `requesterFingerprint` is optional (a local-origin request never
      // carries one), and the dialog used to call `.slice(0, 6)` on it unconditionally, throwing
      // during construction and silently killing the request through to the Rust-side timeout.
      // Reaching the assertion below at all proves construction didn't throw.
      const component = createComponent({
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["requesterDisplayName"]).toBe("agentAccessUnknownApplication");
      expect(mockI18nService.t).toHaveBeenCalledWith("agentAccessUnknownApplication");
    });
  });

  // agent-access-design-spec.md §7.5.2 — the reported scope regression: the agent's brand logo
  // must appear on every request dialog, but only when it derives from an ATTESTED (verified
  // code-signature) identity. `brand`/`brandLogo` are resolved from `params.signature*` only.
  describe("brandLogo", () => {
    it("resolves the brand logo for a verified signature matching a known agent", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        signatureKind: "macosTeamId",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
        signatureValid: true,
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["brand"]).toBe(AgentId.Claude);
      expect(component["brandLogo"]).toBe(AGENT_LOGOS[AgentId.Claude]);
      expect(component["requesterView"].brandLogo).toBe(AGENT_LOGOS[AgentId.Claude]);
    });

    it("falls back to the neutral glyph for a verified signature with no matching brand", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        signatureKind: "macosTeamId",
        signatureIdentity: "ABCDE12345:com.example.someagent",
        signatureValid: true,
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
      expect(component["requesterView"].brandLogo).toBeUndefined();
    });

    it("never resolves a logo for an invalid/unverified signature, even when the identity would otherwise match a known agent", () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        signatureKind: "macosTeamId",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
        signatureValid: false,
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
      expect(component["requesterView"].brandLogo).toBeUndefined();
    });

    // Regression test for the security constraint: `requesterName` is self-reported by the
    // requesting process (or a relay peer), so it must NEVER be able to borrow a known agent's
    // logo just by naming itself "Claude Code" — only a verified code signature can. With no
    // signature present at all (as on a relay-origin request), the brand must stay unresolved
    // even though the display name would otherwise match a known agent exactly.
    it("does not resolve a logo from a spoofed requesterName claiming to be a known agent, with no signature present", () => {
      const component = createComponent({
        requesterName: "Claude Code",
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(component["brand"]).toBeUndefined();
      expect(component["brandLogo"]).toBeUndefined();
      expect(component["requesterView"].name).toBe("Claude Code");
      expect(component["requesterView"].brandLogo).toBeUndefined();
    });
  });

  // M4 (agent-access-architecture.md): matches are a discriminated union of credential/secret
  // kinds — these cover the secret side rendering the same picker/validation/approve/deny logic.
  describe("Secrets Manager secret matches", () => {
    it("preselects a single secret match, keyed by secretId", () => {
      const match = makeSecretMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Name,
        queryValue: "DB_PASSWORD",
        matches: [match],
        matchesTruncated: false,
      });

      expect(component["hasMultipleMatches"]).toBe(false);
      expect(component["approveCredentialRequestForm"].valid).toBe(true);
      expect(component["selectedMatch"]()).toEqual(match);
    });

    it("approves the selected secretId on submit", async () => {
      const match = makeSecretMatch();
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Name,
        queryValue: "DB_PASSWORD",
        matches: [match],
        matchesTruncated: false,
      });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "s1" });
    });

    it("requires a selection among multiple secret matches and tracks the highlighted one", () => {
      const matches = [
        makeSecretMatch({ secretId: "s1", secretName: "DB_PASSWORD", organizationName: "Acme" }),
        makeSecretMatch({ secretId: "s2", secretName: "DB_PASSWORD", organizationName: "Other" }),
      ];
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "db_password",
        matches,
        matchesTruncated: false,
      });

      expect(component["hasMultipleMatches"]).toBe(true);
      expect(component["approveCredentialRequestForm"].valid).toBe(false);

      component["approveCredentialRequestForm"].patchValue({ selectedId: "s2" });

      expect(component["selectedMatch"]()).toEqual(matches[1]);
    });

    it("denies a secret request the same way as a credential request", async () => {
      const component = createComponent({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Name,
        queryValue: "DB_PASSWORD",
        matches: [makeSecretMatch()],
        matchesTruncated: false,
      });

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });

  /**
   * The suites above instantiate the component directly (`createComponent`) and never render the
   * template — deliberate, so exercising the picker/validation logic doesn't drag in every
   * Bitwarden dialog chrome dependency. But that also means every template-level defect fixed by
   * the agent-access-design-spec.md §3.3 redesign — BUG 1 (two same-named, same-org secrets
   * rendering identically), BUG 2 (the secret path showing no consequence copy at all), and BUG 3
   * (the picker's "fields shared" block appearing only after a selection) — would pass unnoticed
   * by every test above. These fixtures render the real template through
   * `app-agent-access-request-dialog` (the shared shell, §7) to close that gap. Mirrors the
   * rendering pattern already used by `project-secrets-request.component.spec.ts`.
   */
  describe("rendering (TestBed.createComponent)", () => {
    let renderDialogRef: MockProxy<DialogRef<ApproveCredentialRequestResult>>;
    let renderI18nService: MockProxy<I18nService>;
    let fixture: ComponentFixture<ApproveCredentialRequestComponent>;

    beforeAll(() => {
      // jsdom does not implement IntersectionObserver; bit-dialog (rendered inside the shared
      // shell) uses it internally for its scroll-shadow logic — same polyfill as
      // agent-access-request-dialog.component.spec.ts and apps/web's
      // offboarding-survey.component.spec.ts.
      (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      };
    });

    function render(params: ApproveCredentialRequestParams) {
      renderDialogRef = mock<DialogRef<ApproveCredentialRequestResult>>();
      // jest-mock-extended proxies every unset property access into a truthy mock function.
      // DialogComponent (rendered inside the shell) branches on both of these — leaving them
      // unset silently hides the close button / misroutes closing (agent-access-design-spec.md
      // §7 gotchas).
      renderDialogRef.disableClose = false;
      renderDialogRef.isDrawer = false;
      renderI18nService = mock<I18nService>();
      // Echo the key and any interpolation args back so assertions can check both which key
      // rendered and what was passed to it, without hardcoding English copy here.
      renderI18nService.t.mockImplementation((key: string, ...args: unknown[]) =>
        args.length > 0 ? `${key}:${args.join(",")}` : key,
      );

      TestBed.configureTestingModule({
        imports: [ApproveCredentialRequestComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: renderDialogRef },
          { provide: I18nService, useValue: renderI18nService },
        ],
      });

      fixture = TestBed.createComponent(ApproveCredentialRequestComponent);
      fixture.detectChanges();
    }

    it("renders two identically-named, identically-orged secrets distinguishably by project — regression test for the reported bug", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "api_key",
        matches: [
          makeSecretMatch({
            secretId: "s1",
            secretName: "API_KEY",
            organizationName: "Acme Inc",
            projectId: "p1",
            projectName: "Marketing site",
          }),
          makeSecretMatch({
            secretId: "s2",
            secretName: "API_KEY",
            organizationName: "Acme Inc",
            projectId: "p2",
            projectName: "Internal tools",
          }),
        ],
        matchesTruncated: false,
      });

      const cards = fixture.debugElement.queryAll(By.css("bit-form-control-card"));
      expect(cards).toHaveLength(2);
      const cardTexts = cards.map((card) => (card.nativeElement as HTMLElement).textContent ?? "");

      // The old picker rendered only secretName + organizationName for both cards — identical
      // text for two different secrets. Asserting the two card texts differ, and that each
      // names its own project, is the regression test for that bug.
      expect(cardTexts[0]).not.toEqual(cardTexts[1]);
      expect(cardTexts[0]).toContain("Marketing site");
      expect(cardTexts[1]).toContain("Internal tools");
    });

    it("falls back to a shortened secretId when projectName is absent, so the card still differs from its identically-named, identically-orged sibling", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "api_key",
        matches: [
          makeSecretMatch({
            secretId: "s1",
            secretName: "API_KEY",
            organizationName: "Acme Inc",
            projectName: "Marketing site",
          }),
          makeSecretMatch({
            secretId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            secretName: "API_KEY",
            organizationName: "Acme Inc",
            // No projectName — a project-less secret, or a project-name decrypt failure that
            // degrades to absent (see SecretMatch's doc). Must not render identically to the
            // sibling above.
          }),
        ],
        matchesTruncated: false,
      });

      const cards = fixture.debugElement.queryAll(By.css("bit-form-control-card"));
      const cardTexts = cards.map((card) => (card.nativeElement as HTMLElement).textContent ?? "");

      expect(cardTexts[0]).not.toEqual(cardTexts[1]);
      expect(cardTexts[1]).toContain("aaaaaaaa…");
    });

    it("renders the secret-kind consequence copy with a disclose-grade band (guards BUG 2)", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Name,
        queryValue: "DB_PASSWORD",
        matches: [makeSecretMatch()],
        matchesTruncated: false,
      });

      // `resolveSecretRequest` never sets `deliveryMode` — the old callout inferred its type from
      // that field, so the secret path always rendered a warning icon with no warning text behind
      // it. The grade here is set explicitly per resource kind (see the component's `grade`
      // field), so both the copy and the band's colour must actually reach the DOM.
      expect(fixture.nativeElement.textContent).toContain("agentAccessSecretDiscloseSummary");
      expect(fixture.nativeElement.querySelector(".tw-border-border-warning")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-icon.bwi-key")).not.toBeNull();
    });

    it("renders the credential metadata-grade band in reference mode, distinct from the disclose grade", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        deliveryMode: "reference",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      expect(fixture.nativeElement.textContent).toContain("agentAccessCredentialMetadataSummary");
      expect(fixture.nativeElement.querySelector(".tw-border-border-base")).not.toBeNull();
      expect(fixture.nativeElement.querySelector(".tw-border-border-warning")).toBeNull();
    });

    it("shows every card's shared-fields detail before any selection is made, unchanged after selecting one — no block appears or disappears (guards BUG 3)", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "github",
        matches: [
          makeMatch({ cipherId: "c1", cipherName: "GitHub (work)", username: "work@example.com" }),
          makeMatch({
            cipherId: "c2",
            cipherName: "GitHub (personal)",
            username: "personal@example.com",
            fieldsShared: { username: true, password: false, totp: true, uri: false },
          }),
        ],
        matchesTruncated: false,
      });

      const cardTextsBefore = fixture.debugElement
        .queryAll(By.css("bit-form-control-card"))
        .map((card) => (card.nativeElement as HTMLElement).textContent ?? "");

      expect(cardTextsBefore[0]).toContain("agentAccessCredentialFieldsSummary");
      expect(cardTextsBefore[1]).toContain("agentAccessCredentialFieldsSummary");

      const radios = fixture.debugElement.queryAll(By.css("input[type=radio]"));
      (radios[1].nativeElement as HTMLInputElement).click();
      fixture.detectChanges();

      const cardTextsAfter = fixture.debugElement
        .queryAll(By.css("bit-form-control-card"))
        .map((card) => (card.nativeElement as HTMLElement).textContent ?? "");

      // Same detail, on the same two cards, before and after — nothing appeared or disappeared.
      expect(cardTextsAfter).toEqual(cardTextsBefore);
    });

    // Truncation is now reported by the lookup path via `matchesTruncated` (see
    // `ApproveCredentialRequestParams`'s doc) rather than inferred here from `matches.length` —
    // these two just confirm the component renders the caveat purely off that flag.
    it("shows the truncation notice when matchesTruncated is true", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "item",
        matches: [makeMatch({ cipherId: "c1" }), makeMatch({ cipherId: "c2" })],
        matchesTruncated: true,
      });

      expect(fixture.nativeElement.textContent).toContain("agentAccessMatchesTruncatedDetail");
    });

    it("does not show the truncation notice when matchesTruncated is false", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Search,
        queryValue: "item",
        matches: [makeMatch({ cipherId: "c1" }), makeMatch({ cipherId: "c2" })],
        matchesTruncated: false,
      });

      expect(fixture.nativeElement.textContent).not.toContain("agentAccessMatchesTruncatedDetail");
    });

    it("approves and closes the dialog when the authorize button is clicked for a single match", async () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      fixture.debugElement
        .query(By.css("#approve-credential-request_button_authorize"))
        .nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(renderDialogRef.close).toHaveBeenCalledWith({ approved: true, selectedId: "c1" });
    });

    it("denies and closes the dialog when the deny button is clicked", () => {
      render({
        requesterFingerprint: "abcdef123456",
        queryType: CredentialQueryType.Id,
        queryValue: "c1",
        matches: [makeMatch()],
        matchesTruncated: false,
      });

      fixture.debugElement
        .query(By.css("#approve-credential-request_button_deny"))
        .nativeElement.click();
      fixture.detectChanges();

      expect(renderDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });
});
