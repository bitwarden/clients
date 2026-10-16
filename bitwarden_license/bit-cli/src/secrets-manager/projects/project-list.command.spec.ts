import { mock } from "jest-mock-extended";

import { ProjectListView } from "@bitwarden/bit-common/secrets-manager/models/view/project-list.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SmProjectResponse } from "../models/sm-project.response";
import { mockSmOrganization, smNotFoundError, smOrgId } from "../spec/sm-test-utils";

import { ProjectListCommand } from "./project-list.command";

describe("ProjectListCommand", () => {
  const projectService = mock<ProjectService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  let command: ProjectListCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new ProjectListCommand(projectService, organizationService, accountService);
  });

  it("lists the organization's projects", async () => {
    const project = Object.assign(new ProjectListView(), {
      id: "22222222-2222-2222-2222-222222222222",
      organizationId: smOrgId,
      name: "Backend",
      read: true,
      write: false,
    });
    projectService.getProjects.mockResolvedValue([project]);

    const response = await command.run(smOrgId);

    expect(response.success).toBe(true);
    expect(projectService.getProjects).toHaveBeenCalledWith(smOrgId);
    const data = (response.data as ListResponse).data as SmProjectResponse[];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ object: "sm-project", id: project.id, name: "Backend" });
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
    expect(projectService.getProjects).not.toHaveBeenCalled();
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
    expect(projectService.getProjects).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.getProjects.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
