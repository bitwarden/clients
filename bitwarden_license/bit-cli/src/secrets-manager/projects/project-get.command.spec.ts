import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView } from "@bitwarden/bit-sm";

import { smNotFoundError, smOrgId, smOrg, smOtherOrgId } from "../spec/sm-test-utils";

import { ProjectGetCommand } from "./project-get.command";

describe("ProjectGetCommand", () => {
  const projectService = mock<ProjectService>();
  const projectId = "22222222-2222-2222-2222-222222222222";
  let command: ProjectGetCommand;

  const makeProject = (organizationId = smOrgId) =>
    Object.assign(new ProjectView(), { id: projectId, organizationId, name: "Backend" });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new ProjectGetCommand(projectService);
  });

  it("returns the project", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject());

    const response = await command.run(smOrg, projectId.toUpperCase());

    expect(response.success).toBe(true);
    expect(projectService.getByProjectId).toHaveBeenCalledWith(projectId, true);
    expect(response.data).toMatchObject({ object: "sm-project", id: projectId, name: "Backend" });
  });

  it("returns not found for a project from another organization", async () => {
    projectService.getByProjectId.mockResolvedValue(makeProject(smOtherOrgId));

    const response = await command.run(smOrg, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrg, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
    expect(projectService.getByProjectId).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.getByProjectId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });
});
