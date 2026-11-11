import { mock } from "jest-mock-extended";

import { ProjectListView, ProjectService } from "@bitwarden/bit-sm";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmProjectResponse } from "../models/sm-project.response";
import { smNotFoundError, smOrgId, smOrg } from "../spec/sm-test-utils";

import { ProjectListCommand } from "./project-list.command";

describe("ProjectListCommand", () => {
  const projectService = mock<ProjectService>();
  let command: ProjectListCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new ProjectListCommand(projectService);
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

    const response = await command.run(smOrg);

    expect(response.success).toBe(true);
    expect(projectService.getProjects).toHaveBeenCalledWith(smOrgId);
    const data = (response.data as ListResponse).data as SmProjectResponse[];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ object: "sm-project", id: project.id, name: "Backend" });
  });

  it("maps a 404 to a friendly error", async () => {
    projectService.getProjects.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
