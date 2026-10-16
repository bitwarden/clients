import { mock } from "jest-mock-extended";

import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { SecretListView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-list.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SmSecretResponse } from "../models/sm-secret.response";
import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { SecretListCommand } from "./secret-list.command";

describe("SecretListCommand", () => {
  const secretService = mock<SecretService>();
  const projectService = mock<ProjectService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
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
    mockSmOrganization(accountService, organizationService);
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOrgId, name: "Backend" }),
    );
    command = new SecretListCommand(
      secretService,
      projectService,
      organizationService,
      accountService,
    );
  });

  it("lists the organization's secrets without values", async () => {
    secretService.getSecrets.mockResolvedValue([secret]);

    const response = await command.run(smOrgId);

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

    const response = await command.run(smOrgId, projectId);

    expect(response.success).toBe(true);
    expect(projectService.getByProjectId).toHaveBeenCalledWith(projectId, true);
    expect(secretService.getSecretsByProject).toHaveBeenCalledWith(smOrgId, projectId);
    expect(secretService.getSecrets).not.toHaveBeenCalled();
  });

  it("rejects a project from another organization", async () => {
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOtherOrgId }),
    );

    const response = await command.run(smOrgId, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
    expect(secretService.getSecretsByProject).not.toHaveBeenCalled();
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrgId, "abc");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
    expect(secretService.getSecrets).not.toHaveBeenCalled();
  });

  it("maps a 404 on a project to a friendly error", async () => {
    projectService.getByProjectId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, projectId);

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });
});
