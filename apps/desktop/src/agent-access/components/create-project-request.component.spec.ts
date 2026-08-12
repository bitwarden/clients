import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

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
});
