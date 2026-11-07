import { mock } from "jest-mock-extended";

import { BulkOperationStatus, ProjectListView, ProjectService } from "@bitwarden/bit-sm";

import { smOrgId, smOrg } from "../spec/sm-test-utils";

import { ProjectDeleteCommand } from "./project-delete.command";

describe("ProjectDeleteCommand", () => {
  const projectService = mock<ProjectService>();
  const firstId = "22222222-2222-2222-2222-222222222222";
  const secondId = "33333333-3333-3333-3333-333333333333";
  let command: ProjectDeleteCommand;

  const projects = [
    Object.assign(new ProjectListView(), { id: firstId, organizationId: smOrgId, name: "One" }),
    Object.assign(new ProjectListView(), { id: secondId, organizationId: smOrgId, name: "Two" }),
  ];
  const status = (id: string, name: string, errorMessage?: string) =>
    Object.assign(new BulkOperationStatus(), { id, name, errorMessage });

  beforeEach(() => {
    jest.clearAllMocks();
    projectService.getProjects.mockResolvedValue(projects);
    command = new ProjectDeleteCommand(projectService);
  });

  it("deletes several projects", async () => {
    projectService.delete.mockResolvedValue([status(firstId, "One"), status(secondId, "Two")]);

    const response = await command.run(smOrg, [firstId, secondId.toUpperCase()]);

    expect(response.success).toBe(true);
    expect(projectService.getProjects).toHaveBeenCalledWith(smOrgId);
    expect(projectService.delete).toHaveBeenCalledWith(projects);
    expect(response.data).toMatchObject({
      object: "list",
      data: [
        { object: "sm-bulk-status", id: firstId, name: "One" },
        { object: "sm-bulk-status", id: secondId, name: "Two" },
      ],
    });
  });

  it("reports projects that could not be deleted", async () => {
    projectService.delete.mockResolvedValue([status(firstId, "One", "Access denied.")]);

    const response = await command.run(smOrg, [firstId]);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "1 of 1 could not be deleted.\nOne (" + firstId + "): Access denied.",
    );
  });

  it("rejects a project that is not in the organization", async () => {
    const unknownId = "44444444-4444-4444-4444-444444444444";

    const response = await command.run(smOrg, [firstId, unknownId]);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The project `" + unknownId + "` was not found, or you do not have access to it.",
    );
    expect(projectService.delete).not.toHaveBeenCalled();
  });

  it("requires at least one id", async () => {
    const response = await command.run(smOrg, []);

    expect(response.success).toBe(false);
    expect(response.message).toBe("At least one `projectId` is required.");
  });
});
