import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { AgentId } from "../models/agent-id";

import {
  ProjectSecretsRequestComponent,
  ProjectSecretsRequestEntry,
  ProjectSecretsRequestParams,
  ProjectSecretsRequestResult,
} from "./project-secrets-request.component";

function makeParams(
  overrides: Partial<ProjectSecretsRequestParams> = {},
): ProjectSecretsRequestParams {
  return {
    projectName: "my-app",
    organizationName: "Acme Inc",
    entries: [{ name: "DB_PASSWORD" }, { name: "API_KEY" }],
    ...overrides,
  };
}

function makeEntries(count: number): ProjectSecretsRequestEntry[] {
  return Array.from({ length: count }, (_, index) => ({ name: `SECRET_${index}` }));
}

describe("ProjectSecretsRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<ProjectSecretsRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<ProjectSecretsRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(params: ProjectSecretsRequestParams): ProjectSecretsRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new ProjectSecretsRequestComponent());
  }

  it("exposes every secret name that will be released, display-only, never a value", () => {
    const component = createComponent(
      makeParams({
        entries: [{ name: "DB_PASSWORD" }, { name: "API_KEY" }, { name: "SMTP_PASS" }],
      }),
    );

    expect(component.params.entries).toHaveLength(3);
    expect(component.params.entries.map((e) => e.name)).toEqual([
      "DB_PASSWORD",
      "API_KEY",
      "SMTP_PASS",
    ]);
    // No entry carries anything but a name — no `value` field exists on the params shape at all.
    for (const entry of component.params.entries) {
      expect(Object.keys(entry)).toEqual(["name"]);
    }
  });

  it("exposes the resolved project and organization names", () => {
    const component = createComponent(
      makeParams({ projectName: "billing-service", organizationName: "Acme Inc" }),
    );

    expect(component.params.projectName).toBe("billing-service");
    expect(component.params.organizationName).toBe("Acme Inc");
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
    it("falls back to a shortened fingerprint when no requester name is present", () => {
      const component = createComponent(makeParams({ requesterFingerprint: "abcdef123456" }));

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });

    it("falls back to the unknown-application label when neither name nor fingerprint is present", () => {
      mockI18nService.t.mockImplementation((key: string) =>
        key === "agentAccessUnknownApplication" ? "Unknown application" : key,
      );

      const component = createComponent(makeParams());

      expect(component["requesterDisplayName"]).toBe("Unknown application");
    });

    it("prefers the requester name when present", () => {
      const component = createComponent(makeParams({ requesterName: "Claude Code" }));

      expect(component["requesterDisplayName"]).toBe("Claude Code");
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
   * Renders the full template through `app-agent-access-request-dialog` (the shared shell,
   * agent-access-design-spec.md §7) so the consequence band, count summary, truncation notice,
   * and the environment/scrubbing caveat — none of which the direct-instantiation tests above can
   * see — are actually exercised. This is the `disclose`-grade sibling of
   * `ProjectListRequestComponent`'s `metadata` grade; the grade assertion below is what proves the
   * two dialogs are visually distinguishable rather than wearing the same warning callout
   * (agent-access-design-spec.md §1, fault 2).
   */
  describe("rendered", () => {
    let fixture: ComponentFixture<ProjectSecretsRequestComponent>;

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

    function render(params: ProjectSecretsRequestParams) {
      mockDialogRef = mock<DialogRef<ProjectSecretsRequestResult>>();
      // jest-mock-extended proxies every unknown property access, including plain fields, into a
      // truthy mock function. DialogComponent branches on `disableClose`/`isDrawer` to decide
      // whether to render its close button and how to route closing — leaving these unset would
      // silently break rendering (agent-access-design-spec.md §7 gotchas).
      mockDialogRef.disableClose = false;
      mockDialogRef.isDrawer = false;
      mockI18nService = mock<I18nService>();
      // Echo the key and any interpolation args back so assertions can check both which key
      // rendered and that the right value was passed to it, without hardcoding English copy here.
      mockI18nService.t.mockImplementation((key: string, ...args: unknown[]) =>
        args.length > 0 ? `${key}:${args.join(",")}` : key,
      );

      TestBed.configureTestingModule({
        imports: [ProjectSecretsRequestComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: I18nService, useValue: mockI18nService },
        ],
      });

      fixture = TestBed.createComponent(ProjectSecretsRequestComponent);
      fixture.detectChanges();
    }

    it("shows a count summary reflecting the entry count", () => {
      render(makeParams({ entries: makeEntries(47) }));

      expect(fixture.nativeElement.textContent).toContain("agentAccessBulkRequestCountSummary:47");
    });

    it("does not show the truncation notice below the cap", () => {
      render(makeParams({ entries: makeEntries(199) }));

      expect(fixture.nativeElement.textContent).not.toContain(
        "agentAccessBulkRequestTruncatedNotice",
      );
    });

    it("shows the truncation notice exactly at the cap", () => {
      render(makeParams({ entries: makeEntries(200) }));

      expect(fixture.nativeElement.textContent).toContain("agentAccessBulkRequestTruncatedNotice");
    });

    it("renders the disclose grade, distinct from project-list-request's metadata grade", () => {
      render(makeParams());

      expect(fixture.nativeElement.querySelector(".tw-border-border-warning")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-icon.bwi-key")).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain(
        "agentAccessBulkRequestConsequenceSummary:2,my-app",
      );
    });

    it("states the environment/scrubbing caveat truthfully — never implies the agent can't see the value", () => {
      render(makeParams());

      expect(fixture.nativeElement.textContent).toContain("agentAccessBulkRequestConsequenceNote");
    });

    it("stays at the default dialog size — a single-column name list doesn't need the width", () => {
      render(makeParams());

      const dialogEl: HTMLElement = fixture.nativeElement.querySelector("bit-dialog");
      expect(dialogEl.className).toContain("md:tw-max-w-xl");
      expect(dialogEl.className).not.toContain("md:tw-max-w-3xl");
    });

    it("keeps the bounded-height internal scroll region and pinned footer at the default size", () => {
      render(makeParams({ entries: makeEntries(200) }));

      // The table's own scroll region — independent of dialog width, which only changes
      // horizontal space (bit-dialog's `dialogSize` maps to a max-width class only).
      const scrollRegion: HTMLElement = fixture.nativeElement.querySelector(
        ".tw-max-h-96.tw-overflow-y-auto",
      );
      expect(scrollRegion).not.toBeNull();
      expect(scrollRegion.querySelector("bit-table")).not.toBeNull();

      // The consequence band (carrying the environment/scrubbing caveat) and footer buttons must
      // still render outside/after that scroll region rather than inside it.
      expect(fixture.nativeElement.querySelector("app-agent-access-consequence")).not.toBeNull();
      expect(
        fixture.debugElement.query(By.css("#project-secrets-request_button_authorize")),
      ).not.toBeNull();
      expect(
        fixture.debugElement.query(By.css("#project-secrets-request_button_deny")),
      ).not.toBeNull();
    });

    it("never renders a secret value, only names", () => {
      render(makeParams({ entries: [{ name: "DB_PASSWORD" }] }));

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("DB_PASSWORD");
      // The params shape has no `value` field at all (asserted above), so this is a template-level
      // sanity check that nothing else was concatenated in next to the name.
      expect(fixture.nativeElement.querySelectorAll("tbody tr td").length).toBe(1);
    });

    it("approves and closes the dialog when the authorize button is clicked", async () => {
      render(makeParams());

      fixture.debugElement
        .query(By.css("#project-secrets-request_button_authorize"))
        .nativeElement.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true });
    });

    it("denies and closes the dialog when the deny button is clicked", () => {
      render(makeParams());

      fixture.debugElement
        .query(By.css("#project-secrets-request_button_deny"))
        .nativeElement.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });
});
