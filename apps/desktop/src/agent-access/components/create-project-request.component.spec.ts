import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { AgentId } from "../models/agent-id";

import {
  CreateProjectRequestComponent,
  CreateProjectRequestParams,
  CreateProjectRequestResult,
} from "./create-project-request.component";

const UserOne = "user-1" as UserId;

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return { id: "org-1", name: "Acme Inc", ...overrides } as unknown as Organization;
}

function makeParams(
  overrides: Partial<CreateProjectRequestParams> = {},
): CreateProjectRequestParams {
  return {
    projectName: "my-app",
    organizations: [makeOrg()],
    userId: UserOne,
    ...overrides,
  };
}

describe("CreateProjectRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<CreateProjectRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<CreateProjectRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(params: CreateProjectRequestParams): CreateProjectRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new CreateProjectRequestComponent());
  }

  describe("create mode (default)", () => {
    it("auto-selects the only organization", () => {
      const component = createComponent(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));

      expect(component["createProjectRequestForm"].value.organizationId).toBe("org-1");
    });

    it("blocks submit when no organization is selected", async () => {
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })] }),
      );

      await component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("approves with the selected organizationId", async () => {
      const component = createComponent(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, organizationId: "org-1" });
    });

    it("preselects the session-remembered last organization when valid", () => {
      const component = createComponent(
        makeParams({
          organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })],
          lastOrganizationId: "org-2",
        }),
      );

      expect(component["createProjectRequestForm"].value.organizationId).toBe("org-2");
    });
  });

  describe("rename mode", () => {
    it("shows the current -> proposed name and approves without an organizationId", async () => {
      const component = createComponent(
        makeParams({
          mode: "rename",
          projectName: "my-app",
          newProjectName: "renamed-app",
          organizations: [],
        }),
      );

      expect(component["isRename"]()).toBe(true);

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

  // Rendering tests (agent-access-design-spec.md §7 shell + §2.1 grades) — mount the real
  // template via `TestBed.createComponent` to cover what direct instantiation cannot: the shell
  // actually renders with grade `change` in both modes, and the create/rename branches actually
  // render their differing bodies and submit-disable behaviour.
  describe("rendering", () => {
    let fixture: ComponentFixture<CreateProjectRequestComponent>;
    let mockDialogRefRender: MockProxy<DialogRef<CreateProjectRequestResult>>;

    beforeAll(() => {
      // jsdom does not implement IntersectionObserver; bit-dialog's scroll-shadow logic (inside
      // the shared shell this component now composes) uses it internally. Same polyfill as
      // agent-access-request-dialog.component.spec.ts / offboarding-survey.component.spec.ts.
      (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      };
    });

    function render(
      params: CreateProjectRequestParams,
    ): ComponentFixture<CreateProjectRequestComponent> {
      mockDialogRefRender = mock<DialogRef<CreateProjectRequestResult>>();
      // jest-mock-extended proxies every unset property access into a truthy mock function;
      // DialogComponent branches on both to decide whether to render its close button and how
      // to route close() — see agent-access-request-dialog.component.spec.ts for the full story.
      mockDialogRefRender.disableClose = false;
      mockDialogRefRender.isDrawer = false;
      const i18n = mock<I18nService>();
      i18n.t.mockImplementation((key: string) => key);

      TestBed.configureTestingModule({
        imports: [CreateProjectRequestComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: mockDialogRefRender },
          { provide: I18nService, useValue: i18n },
        ],
      });

      const f = TestBed.createComponent(CreateProjectRequestComponent);
      f.detectChanges();
      return f;
    }

    const authorizeButton = () =>
      fixture.debugElement.query(By.css("#create-project-request_button_authorize"))
        .nativeElement as HTMLButtonElement;

    it("renders the change-grade consequence band in create mode", () => {
      fixture = render(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));

      expect(fixture.nativeElement.querySelector(".tw-border-border-brand")).not.toBeNull();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("agentAccessProjectCreateConsequenceSummary");
    });

    it("renders the change-grade consequence band in rename mode", () => {
      fixture = render(
        makeParams({ mode: "rename", projectName: "my-app", newProjectName: "renamed-app" }),
      );

      expect(fixture.nativeElement.querySelector(".tw-border-border-brand")).not.toBeNull();
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("agentAccessProjectRenameConsequenceSummary");
    });

    describe("create mode", () => {
      it("shows an organization picker and disables submit until the form is valid", () => {
        fixture = render(
          makeParams({
            organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })],
          }),
        );

        expect(
          fixture.debugElement.query(By.css("#create-project-request_select_organization")),
        ).not.toBeNull();
        expect(authorizeButton().getAttribute("aria-disabled")).toBe("true");
      });

      it("enables submit once an organization is auto-selected", () => {
        fixture = render(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));

        expect(authorizeButton().hasAttribute("aria-disabled")).toBe(false);
      });
    });

    describe("rename mode", () => {
      it("shows the current and new names distinctly, with no organization picker, and submit always enabled", () => {
        fixture = render(
          makeParams({
            mode: "rename",
            projectName: "my-app",
            newProjectName: "renamed-app",
            organizations: [],
          }),
        );

        const currentName = fixture.debugElement.query(
          By.css("#create-project-request_text_current-name"),
        ).nativeElement as HTMLElement;
        const newName = fixture.debugElement.query(By.css("#create-project-request_text_new-name"))
          .nativeElement as HTMLElement;

        expect(currentName.textContent).toContain("my-app");
        expect(newName.textContent).toContain("renamed-app");
        expect(
          fixture.debugElement.query(By.css("#create-project-request_select_organization")),
        ).toBeNull();
        expect(authorizeButton().hasAttribute("aria-disabled")).toBe(false);
      });
    });
  });
});
