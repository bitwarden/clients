import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView, SecretListView, SecretService } from "@bitwarden/bit-sm";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmSecretResponse } from "../models/sm-secret.response";
import { smNotFoundError, smOrgId, smOrg, smOtherOrgId } from "../spec/sm-test-utils";

import { SecretListCommand } from "./secret-list.command";

describe("SecretListCommand", () => {
  const secretService = mock<SecretService>();
  const projectService = mock<ProjectService>();
  const projectId = "33333333-3333-3333-3333-333333333333";
  let command: SecretListCommand;

  const secret = Object.assign(new SecretListView(), {
    id: "22222222-2222-2222-2222-222222222222",
    organizationId: smOrgId,
    name: "DB_PASSWORD",
    projects: [{ id: projectId, name: "Backend", decryptionError: false }],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOrgId }),
    );
    command = new SecretListCommand(secretService, projectService);
  });

  it("lists the organization's secrets without values", async () => {
    secretService.getSecrets.mockResolvedValue([secret]);

    const response = await command.run(smOrg);

    expect(response.success).toBe(true);
    expect(secretService.getSecrets).toHaveBeenCalledWith(smOrgId);
    const data = (response.data as ListResponse).data as SmSecretResponse[];
    expect(data[0]).toMatchObject({
      object: "sm-secret",
      key: "DB_PASSWORD",
      projects: [{ id: projectId, name: "Backend" }],
    });
    expect(data[0].value).toBeUndefined();
  });

  it("lists a project's secrets when a project id is given", async () => {
    secretService.getSecretsByProject.mockResolvedValue([secret]);

    const response = await command.run(smOrg, projectId);

    expect(response.success).toBe(true);
    expect(secretService.getSecretsByProject).toHaveBeenCalledWith(smOrgId, projectId);
    expect(secretService.getSecrets).not.toHaveBeenCalled();
  });

  it("returns not found for a project from another organization, even when empty", async () => {
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOtherOrgId }),
    );
    secretService.getSecretsByProject.mockResolvedValue([]);

    const response = await command.run(smOrg, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
    expect(secretService.getSecretsByProject).not.toHaveBeenCalled();
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrg, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
  });

  it("maps a 404 on a project to a friendly error", async () => {
    projectService.getByProjectId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });
});
