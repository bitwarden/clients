import { mock } from "jest-mock-extended";

import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { ServiceAccountView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { CountService } from "@bitwarden/bit-common/secrets-manager/shared/counts/count.service";
import { OrganizationCountsResponse } from "@bitwarden/bit-common/secrets-manager/shared/counts/models/responses/organization-counts.response";
import { ProjectCountsResponse } from "@bitwarden/bit-common/secrets-manager/shared/counts/models/responses/project-counts.response";
import { ServiceAccountCountsResponse } from "@bitwarden/bit-common/secrets-manager/shared/counts/models/responses/service-account-counts.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { CountsCommand } from "./counts.command";

describe("CountsCommand", () => {
  const countService = mock<CountService>();
  const projectService = mock<ProjectService>();
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const projectId = "22222222-2222-2222-2222-222222222222";
  const machineAccountId = "33333333-3333-3333-3333-333333333333";
  let command: CountsCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOrgId }),
    );
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), { id: machineAccountId, organizationId: smOrgId }),
    );
    command = new CountsCommand(
      countService,
      projectService,
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("returns organization counts by default", async () => {
    countService.getOrganizationCounts.mockResolvedValue(
      new OrganizationCountsResponse({ Projects: 2, Secrets: 5, ServiceAccounts: 1 }),
    );

    const response = await command.run(smOrgId);

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      object: "sm-counts",
      scope: "organization",
      id: smOrgId,
      projects: 2,
      secrets: 5,
      machineAccounts: 1,
    });
  });

  it("returns project counts", async () => {
    countService.getProjectCounts.mockResolvedValue(
      new ProjectCountsResponse({ People: 3, Secrets: 4, ServiceAccounts: 2 }),
    );

    const response = await command.run(smOrgId, { projectId });

    expect(response.success).toBe(true);
    expect(countService.getProjectCounts).toHaveBeenCalledWith(projectId);
    expect(response.data).toMatchObject({
      scope: "project",
      id: projectId,
      people: 3,
      secrets: 4,
      machineAccounts: 2,
    });
  });

  it("returns machine account counts", async () => {
    countService.getServiceAccountCounts.mockResolvedValue(
      new ServiceAccountCountsResponse({ Projects: 1, People: 2, AccessTokens: 3 }),
    );

    const response = await command.run(smOrgId, { machineAccountId });

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      scope: "machine-account",
      id: machineAccountId,
      projects: 1,
      people: 2,
      accessTokens: 3,
    });
  });

  it("rejects a project from another organization", async () => {
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOtherOrgId }),
    );

    const response = await command.run(smOrgId, { projectId });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
    expect(countService.getProjectCounts).not.toHaveBeenCalled();
  });

  it("rejects a machine account from another organization", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), {
        id: machineAccountId,
        organizationId: smOtherOrgId,
      }),
    );

    const response = await command.run(smOrgId, { machineAccountId });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(countService.getServiceAccountCounts).not.toHaveBeenCalled();
  });

  it("rejects both a project and a machine account", async () => {
    const response = await command.run(smOrgId, { projectId, machineAccountId });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Specify either `projectid` or `machineaccountid`, not both.");
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrgId, { projectId: "abc" });

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
    expect(countService.getOrganizationCounts).not.toHaveBeenCalled();
  });

  it("maps a 404 on a machine account to a friendly error", async () => {
    countService.getServiceAccountCounts.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, { machineAccountId });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });
});
