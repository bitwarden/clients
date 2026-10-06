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
  AgentAccessSecretsService,
  SmProjectMatch,
} from "../services/agent-access-secrets.service";

import {
  CreateSecretRequestComponent,
  CreateSecretRequestParams,
  CreateSecretRequestResult,
} from "./create-secret-request.component";

const UserOne = "user-1" as UserId;

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Acme Inc",
    isAdmin: false,
    ...overrides,
  } as unknown as Organization;
}

function makeParams(overrides: Partial<CreateSecretRequestParams> = {}): CreateSecretRequestParams {
  return {
    requesterFingerprint: "abcdef123456",
    secretName: "DB_PASSWORD",
    secretValue: "hunter2",
    organizations: [makeOrg()],
    userId: UserOne,
    ...overrides,
  };
}

/** Lets pending microtasks (the `listProjects` promise driving the `projects` signal) settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

describe("CreateSecretRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<CreateSecretRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;
  let mockListProjects: jest.Mock;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<CreateSecretRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
    // Configure `mockListProjects.mockResolvedValue(...)` BEFORE calling `createComponent` —
    // the component subscribes (via `toSignal`) as soon as it's constructed, so a mock
    // reconfigured afterwards is too late for the initial (and often only) call.
    mockListProjects = jest.fn().mockResolvedValue([]);
  });

  function createComponent(params: CreateSecretRequestParams): CreateSecretRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: AgentAccessSecretsService,
          useValue: { listProjects: mockListProjects },
        },
      ],
    });

    return TestBed.runInInjectionContext(() => new CreateSecretRequestComponent());
  }

  describe("organization preselection", () => {
    it("auto-selects the only organization", () => {
      const component = createComponent(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));

      expect(component["createSecretRequestForm"].value.organizationId).toBe("org-1");
    });

    it("does not auto-select when there is more than one organization and no remembered choice", () => {
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })] }),
      );

      expect(component["createSecretRequestForm"].value.organizationId).toBeNull();
      expect(component["createSecretRequestForm"].valid).toBe(false);
    });

    it("preselects the session-remembered last organization when it's still a valid option", () => {
      const component = createComponent(
        makeParams({
          organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })],
          lastOrganizationId: "org-2",
        }),
      );

      expect(component["createSecretRequestForm"].value.organizationId).toBe("org-2");
    });
  });

  describe("project requirement", () => {
    it("blocks submit when no project is selected for a non-admin organization", async () => {
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1", isAdmin: false })] }),
      );
      await flush();

      expect(component["noProjectSelected"]()).toBe(true);
      expect(component["isAdminRelaxed"]()).toBe(false);

      await component.submit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("allows submit with no project selected for an admin organization, and reports the relaxation", async () => {
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1", isAdmin: true })] }),
      );
      await flush();

      expect(component["isAdminRelaxed"]()).toBe(true);

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        approved: true,
        organizationId: "org-1",
        projectId: undefined,
      });
    });

    it("approves with the selected project id", async () => {
      mockListProjects.mockResolvedValue([
        { id: "proj-1", name: "my-app", write: true } as SmProjectMatch,
      ]);
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1", isAdmin: false })] }),
      );
      await flush();
      component["createSecretRequestForm"].patchValue({ projectId: "proj-1" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        approved: true,
        organizationId: "org-1",
        projectId: "proj-1",
      });
    });
  });

  describe("project list", () => {
    it("only ever surfaces write === true projects", async () => {
      mockListProjects.mockResolvedValue([
        { id: "proj-write", name: "writable", write: true } as SmProjectMatch,
        { id: "proj-read", name: "read-only", write: false } as SmProjectMatch,
      ]);
      const component = createComponent(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));
      await flush();

      expect(component["projects"]().map((p) => p.id)).toEqual(["proj-write"]);
    });

    it("reloads the project list when the organization selection changes", async () => {
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1" }), makeOrg({ id: "org-2" })] }),
      );
      await flush();
      mockListProjects.mockClear();

      component["createSecretRequestForm"].patchValue({ organizationId: "org-2" });
      await flush();

      expect(mockListProjects).toHaveBeenCalledWith("org-2", UserOne);
    });
  });

  describe("project hint preselect", () => {
    it("preselects a writable project whose decrypted name matches the hint exactly", async () => {
      mockListProjects.mockResolvedValue([
        { id: "proj-1", name: "my-app", write: true } as SmProjectMatch,
        { id: "proj-2", name: "other-app", write: true } as SmProjectMatch,
      ]);
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1" })], projectHint: "my-app" }),
      );
      await flush();

      expect(component["createSecretRequestForm"].value.projectId).toBe("proj-1");
    });

    it("does not preselect anything when the hint matches no writable project", async () => {
      mockListProjects.mockResolvedValue([
        { id: "proj-1", name: "unrelated", write: true } as SmProjectMatch,
      ]);
      const component = createComponent(
        makeParams({ organizations: [makeOrg({ id: "org-1" })], projectHint: "my-app" }),
      );
      await flush();

      expect(component["createSecretRequestForm"].value.projectId).toBeNull();
    });

    it("prefers the session-remembered last project over the hint", async () => {
      mockListProjects.mockResolvedValue([
        { id: "proj-1", name: "my-app", write: true } as SmProjectMatch,
        { id: "proj-2", name: "other-app", write: true } as SmProjectMatch,
      ]);
      const component = createComponent(
        makeParams({
          organizations: [makeOrg({ id: "org-1" })],
          projectHint: "my-app",
          lastProjectId: "proj-2",
        }),
      );
      await flush();

      expect(component["createSecretRequestForm"].value.projectId).toBe("proj-2");
    });
  });

  describe("new project flow", () => {
    it("reveals the new-project-name requirement and blocks submit until a name is entered", async () => {
      const component = createComponent(makeParams({ organizations: [makeOrg({ id: "org-1" })] }));
      await flush();
      component["createSecretRequestForm"].patchValue({
        projectId: component["NEW_PROJECT_SENTINEL"],
      });

      expect(component["creatingNewProject"]()).toBe(true);

      await component.submit();
      expect(mockDialogRef.close).not.toHaveBeenCalled();

      component["createSecretRequestForm"].patchValue({ newProjectName: "brand-new-project" });
      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        approved: true,
        organizationId: "org-1",
        newProjectName: "brand-new-project",
      });
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

  // M6: a `generate: true` create request carries no value at all — the dialog must never be
  // handed one to display, even accidentally.
  describe("generated value mode", () => {
    it("carries generation options instead of a secret value", () => {
      const component = createComponent(
        makeParams({ secretValue: undefined, generated: { length: 64, symbols: false } }),
      );

      expect(component.params.secretValue).toBeUndefined();
      expect(component.params.generated).toEqual({ length: 64, symbols: false });
    });
  });

  // Display-only invariant: nothing in this dialog lets the user edit the proposed name or
  // value — the params are the single source of truth for what gets created, and the only way
  // to change them is to deny and let the agent re-request.
  describe("proposed secret is display-only", () => {
    it("exposes the proposed name and value as read-only params, never as editable form controls", () => {
      const component = createComponent(
        makeParams({ secretName: "API_KEY", secretValue: "sk-live" }),
      );

      expect(component.params.secretName).toBe("API_KEY");
      expect(component.params.secretValue).toBe("sk-live");
      expect(Object.keys(component["createSecretRequestForm"].controls)).toEqual([
        "organizationId",
        "projectId",
        "newProjectName",
      ]);
    });
  });

  // Rendering tests (agent-access-design-spec.md §7 shell + §2.1 grades) — unlike the suites
  // above, these mount the real template via `TestBed.createComponent` to catch what direct
  // instantiation cannot: the shell actually renders, the reveal toggle actually flips the DOM
  // input's type, and the project-required/admin-relaxed states actually disable/enable the
  // rendered submit button.
  describe("rendering", () => {
    let fixture: ComponentFixture<CreateSecretRequestComponent>;
    let mockDialogRefRender: MockProxy<DialogRef<CreateSecretRequestResult>>;
    let mockListProjectsRender: jest.Mock;

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

    async function render(
      params: CreateSecretRequestParams,
    ): Promise<ComponentFixture<CreateSecretRequestComponent>> {
      mockDialogRefRender = mock<DialogRef<CreateSecretRequestResult>>();
      // jest-mock-extended proxies every unset property access into a truthy mock function;
      // DialogComponent branches on both to decide whether to render its close button and how
      // to route close() — see agent-access-request-dialog.component.spec.ts for the full story.
      mockDialogRefRender.disableClose = false;
      mockDialogRefRender.isDrawer = false;
      const i18n = mock<I18nService>();
      i18n.t.mockImplementation((key: string, ...args: string[]) =>
        args.length > 0 ? `${key}:${args.join(",")}` : key,
      );
      mockListProjectsRender = jest.fn().mockResolvedValue([]);

      await TestBed.configureTestingModule({
        imports: [CreateSecretRequestComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: params },
          { provide: DialogRef, useValue: mockDialogRefRender },
          { provide: I18nService, useValue: i18n },
          {
            provide: AgentAccessSecretsService,
            useValue: { listProjects: mockListProjectsRender },
          },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(CreateSecretRequestComponent);
      f.detectChanges();
      await flush();
      f.detectChanges();
      return f;
    }

    const valueInput = () =>
      fixture.debugElement.query(By.css("#create-secret-request_input_value"))
        .nativeElement as HTMLInputElement;
    const revealButton = () =>
      fixture.debugElement.query(By.css("#create-secret-request_button_reveal-value"))
        .nativeElement as HTMLButtonElement;
    const authorizeButton = () =>
      fixture.debugElement.query(By.css("#create-secret-request_button_authorize"))
        .nativeElement as HTMLButtonElement;

    it("renders the change-grade consequence band with the create-secret summary", async () => {
      fixture = await render(makeParams());

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain("agentAccessCreateSecretConsequenceSummary");

      // Grade `change` renders the left rule in the brand token, per the shared consequence
      // component's CONSEQUENCE_STYLES mapping (agent-access-design-spec.md §2.2).
      expect(fixture.nativeElement.querySelector(".tw-border-border-brand")).not.toBeNull();
    });

    describe("agent-supplied value branch", () => {
      it("masks the value by default and the reveal toggle un-masks it without changing the value", async () => {
        fixture = await render(makeParams({ secretValue: "hunter2" }));

        expect(valueInput().type).toBe("password");
        expect(valueInput().value).toBe("hunter2");

        revealButton().click();
        fixture.detectChanges();

        expect(valueInput().type).toBe("text");
        expect(valueInput().value).toBe("hunter2");

        revealButton().click();
        fixture.detectChanges();

        expect(valueInput().type).toBe("password");
      });
    });

    describe("generated value branch", () => {
      it("shows the generated-value reassurance and renders no value input at all", async () => {
        fixture = await render(
          makeParams({ secretValue: undefined, generated: { length: 64, symbols: false } }),
        );

        expect(fixture.debugElement.query(By.css("#create-secret-request_input_value"))).toBeNull();

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain("agentAccessGeneratedValueNoticeTitle");
        expect(text).toContain("agentAccessGeneratedValueNotice:64");
      });
    });

    describe("project requirement states", () => {
      it("shows the project-required error and disables submit for a non-admin org with no project", async () => {
        fixture = await render(
          makeParams({ organizations: [makeOrg({ id: "org-1", isAdmin: false })] }),
        );

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain("agentAccessCreateProjectRequired");
        expect(text).not.toContain("agentAccessCreateAdminOnlyWarning");
        expect(authorizeButton().getAttribute("aria-disabled")).toBe("true");
      });

      it("shows the admin-relaxed warning and leaves submit enabled for an admin org with no project", async () => {
        fixture = await render(
          makeParams({ organizations: [makeOrg({ id: "org-1", isAdmin: true })] }),
        );

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain("agentAccessCreateAdminOnlyWarning");
        expect(text).not.toContain("agentAccessCreateProjectRequired");
        expect(authorizeButton().hasAttribute("aria-disabled")).toBe(false);
      });
    });
  });
});
