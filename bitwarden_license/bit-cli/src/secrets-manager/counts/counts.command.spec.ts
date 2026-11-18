import { mock } from "jest-mock-extended";

import {
  CountService,
  OrganizationCountsResponse,
  ProjectService,
  ProjectCountsResponse,
  ProjectView,
  ServiceAccountCountsResponse,
  ServiceAccountService,
  ServiceAccountView,
} from "@bitwarden/bit-sm";

import { smNotFoundError, smOrgId, smOtherOrgId, smOrg } from "../spec/sm-test-utils";

import { CountsCommand } from "./counts.command";

describe("CountsCommand", () => {
  const countService = mock<CountService>();
  const projectService = mock<ProjectService>();
  const serviceAccountService = mock<ServiceAccountService>();
  const projectId = "22222222-2222-2222-2222-222222222222";
  const machineAccountId = "33333333-3333-3333-3333-333333333333";
  let command: CountsCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOrgId }),
    );
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), { id: machineAccountId, organizationId: smOrgId }),
    );
    command = new CountsCommand(countService, projectService, serviceAccountService);
  });

  it("returns organization counts by default", async () => {
    countService.getOrganizationCounts.mockResolvedValue(
      new OrganizationCountsResponse({ Projects: 2, Secrets: 5, ServiceAccounts: 1 }),
    );

    const response = await command.run(smOrg);

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

    const response = await command.run(smOrg, { projectId });

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

    const response = await command.run(smOrg, { machineAccountId });

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      scope: "machine-account",
      id: machineAccountId,
      projects: 1,
      people: 2,
      accessTokens: 3,
    });
  });

  it("maps a 404 on a project to a friendly error", async () => {
    projectService.getByProjectId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, { projectId });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The project was not found, or you do not have access to it.");
  });

  it("rejects a project from another organization", async () => {
    projectService.getByProjectId.mockResolvedValue(
      Object.assign(new ProjectView(), { id: projectId, organizationId: smOtherOrgId }),
    );

    const response = await command.run(smOrg, { projectId });

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

    const response = await command.run(smOrg, { machineAccountId });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(countService.getServiceAccountCounts).not.toHaveBeenCalled();
  });

  it("rejects both a project and a machine account", async () => {
    const response = await command.run(smOrg, { projectId, machineAccountId });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Specify either `projectid` or `machineaccountid`, not both.");
  });

  it("rejects an invalid project id", async () => {
    const response = await command.run(smOrg, { projectId: "abc" });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
  });

  it("maps a 404 on a machine account to a friendly error", async () => {
    countService.getServiceAccountCounts.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, { machineAccountId });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });
});
