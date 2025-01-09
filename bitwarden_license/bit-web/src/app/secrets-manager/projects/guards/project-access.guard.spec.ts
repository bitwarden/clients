import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { RouterService } from "../../../../../../../apps/web/src/app/core/router.service";
import { ProjectView } from "../../models/view/project.view";
import { ProjectService } from "../project.service";

import { projectAccessGuard } from "./project-access.guard";

@Component({
  template: "",
})
export class GuardedRouteTestComponent {}

@Component({
  template: "",
})
export class RedirectTestComponent {}

describe("Project Redirect Guard", () => {
  let organizationService: MockProxy<OrganizationService>;
  let routerService: MockProxy<RouterService>;
  let projectServiceMock: MockProxy<ProjectService>;
  let i18nServiceMock: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let router: Router;

  const smOrg1 = { id: "123", canAccessSecretsManager: true } as Organization;
  const projectView = {
    id: "123",
    organizationId: "123",
    name: "project-name",
    creationDate: Date.now.toString(),
    revisionDate: Date.now.toString(),
    read: true,
    write: true,
  } as ProjectView;

  beforeEach(async () => {
    organizationService = mock<OrganizationService>();
    routerService = mock<RouterService>();
    projectServiceMock = mock<ProjectService>();
    i18nServiceMock = mock<I18nService>();
    toastService = mock<ToastService>();

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          {
            path: "sm/:organizationId/projects/:projectId",
            component: GuardedRouteTestComponent,
            canActivate: [projectAccessGuard],
          },
          {
            path: "sm",
            component: RedirectTestComponent,
          },
          {
            path: "sm/:organizationId/projects",
            component: RedirectTestComponent,
          },
        ]),
      ],
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: RouterService, useValue: routerService },
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ToastService, useValue: toastService },
      ],
    });

    router = TestBed.inject(Router);
  });

  it("redirects to sm/{orgId}/projects/{projectId} if project exists", async () => {
    // Arrange
    organizationService.getAll.mockResolvedValue([smOrg1]);
    projectServiceMock.getByProjectId.mockReturnValue(Promise.resolve(projectView));

    // Act
    await router.navigateByUrl("sm/123/projects/123");

    // Assert
    expect(router.url).toBe("/sm/123/projects/123");
  });

  it("redirects to sm/projects if project does not exist", async () => {
    // Arrange
    organizationService.getAll.mockResolvedValue([smOrg1]);

    // Act
    await router.navigateByUrl("sm/123/projects/124");

    // Assert
    expect(router.url).toBe("/sm/123/projects");
  });

  it("redirects to sm/123/projects if exception occurs while looking for Project", async () => {
    // Arrange
    jest.spyOn(projectServiceMock, "getByProjectId").mockImplementation(() => {
      throw new Error("Test error");
    });
    jest.spyOn(i18nServiceMock, "t").mockReturnValue("Project not found");

    // Act
    await router.navigateByUrl("sm/123/projects/123");
    // Assert
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "Project not found",
    });
    expect(router.url).toBe("/sm/123/projects");
  });
});
