import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

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
});
