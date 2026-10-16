import { mock } from "jest-mock-extended";

import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { ProjectGetCommand } from "./project-get.command";

describe("ProjectGetCommand", () => {
  const projectService = mock<ProjectService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const projectId = "22222222-2222-2222-2222-222222222222";
  let command: ProjectGetCommand;

  const makeProject = (organizationId = smOrgId) =>
    Object.assign(new ProjectView(), { id: projectId, organizationId, name: "Backend" });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new ProjectGetCommand(projectService, organizationService, accountService);
  });

  it("returns the project", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject());

    const response = await command.run(smOrgId, projectId.toUpperCase());

    expect(response.success).toBe(true);
    expect(projectService.getByProjectId).toHaveBeenCalledWith(projectId, true);
    expect(response.data).toMatchObject({ object: "sm-project", id: projectId, name: "Backend" });
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid", projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrgId, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
    expect(projectService.getByProjectId).not.toHaveBeenCalled();
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
    expect(projectService.getByProjectId).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.getByProjectId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });

  it("treats a project from another organization as not found", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject(smOtherOrgId));

    const response = await command.run(smOrgId, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });
});
