import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView } from "@bitwarden/bit-sm";

import {
  encodeSmRequest,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
  smOrg,
} from "../spec/sm-test-utils";

import { ProjectCreateCommand } from "./project-create.command";

describe("ProjectCreateCommand", () => {
  const projectService = mock<ProjectService>();
  let command: ProjectCreateCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new ProjectCreateCommand(projectService);
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
      smOrg,
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

    const response = await command.run(smOrg, { name: "Backend" });

    expect(response.success).toBe(true);
  });

  it("requires a name", async () => {
    const response = await command.run(smOrg, { name: "" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(projectService.create).not.toHaveBeenCalled();
  });

  it("rejects a request for another organization", async () => {
    const response = await command.run(smOrg, { organizationId: smOtherOrgId, name: "x" });

    expect(response.success).toBe(false);
    expect(projectService.create).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.create.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, { name: "Backend" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
