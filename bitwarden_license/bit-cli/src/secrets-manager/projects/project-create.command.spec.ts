import { mock } from "jest-mock-extended";

import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import {
  encodeSmRequest,
  mockSmOrganization,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
} from "../spec/sm-test-utils";

import { ProjectCreateCommand } from "./project-create.command";

describe("ProjectCreateCommand", () => {
  const projectService = mock<ProjectService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  let command: ProjectCreateCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    command = new ProjectCreateCommand(projectService, organizationService, accountService);
  });

  it("creates the project", async () => {
    projectService.create.mockResolvedValue(
      Object.assign(new ProjectView(), {
        id: "22222222-2222-2222-2222-222222222222",
        organizationId: smOrgId,
        name: "Backend",
      }),
    );

    const response = await command.run(
      smOrgId,
      encodeSmRequest({ organizationId: smOrgId, name: "Backend" }),
    );

    expect(response.success).toBe(true);
    expect(projectService.create).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ organizationId: smOrgId, name: "Backend" }),
    );
    expect(response.data).toMatchObject({ object: "sm-project", name: "Backend" });
  });

  it("accepts an object body", async () => {
    projectService.create.mockResolvedValue(new ProjectView());

    const response = await command.run(smOrgId, { name: "Backend" });

    expect(response.success).toBe(true);
  });

  it("requires a name", async () => {
    const response = await command.run(smOrgId, { name: "" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(projectService.create).not.toHaveBeenCalled();
  });

  it("rejects a request for another organization", async () => {
    const response = await command.run(smOrgId, { organizationId: smOtherOrgId, name: "x" });

    expect(response.success).toBe(false);
    expect(projectService.create).not.toHaveBeenCalled();
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, { name: "Backend" });

    expect(response.success).toBe(false);
    expect(projectService.create).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.create.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, { name: "Backend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
